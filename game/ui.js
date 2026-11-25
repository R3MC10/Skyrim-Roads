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
  const onlineBtn = () => APP ? `<button class="btn pri" data-act="online" style="width:100%;margin-top:8px"> Play online with friends</button><p class="sub" style="margin-top:6px">The shared world opens in Chrome (sign in to Claude once). Your online character is separate from this phone's offline one.</p>` : "";
  const KIND = { city: "City", town: "Town", farm: "Farm", dungeon: "Dungeon", fort: "Fort", camp: "Camp", lair: "Dragon lair", stone: "Standing stone", shrine: "Shrine", landmark: "Landmark" };
  const TABS = [
    ["map", "Travel", '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'],
    ["hero", "Hero", '<circle cx="12" cy="7" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/>'],
    ["pack", "Pack", '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 016 0v2"/>'],
    ["town", "Area", '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>'],
    ["log", "Journal", '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>'],
  ];
  let S = null, net = {}, tab = "map", selected = null, others = [], bags = [];
  const TI = typeof TOMEINFO !== "undefined" ? TOMEINFO : null;   // spell tome info before you buy or read it (tomeinfo.js)
  if (TI) TI.bind(() => S);
  const tiBox = (item) => (TI ? TI.box(S, item) : "");
  const tiCls = (item) => (TI && TI.isTome(item) ? " ti-row" : "");
  let zoom = innerWidth < 700 ? 2.4 : 1, follow = true, center = [0.5, 0.5], view = {}, version = 0, rendered = -1, lastPanelRender = 0;
  let townCtx = null;   // locscreen.js: what panelTown found at this place, for the full-screen scene
  let townShop = null, townShopAt = null, townNews = false, forgeTab = "make", forgeGroup = "iron", packOpen = null, searchText = "", uxAllPlaces = false, uxHelpOpen = null, packSearch = "";
  let raidDocs = [], raidSeen = null, raidJoined = null, raidAuto = null, enchDraft = {};
  let chatDocs = [], chatRaw = [], chatCh = "world", chatDraft = "", chatSeen = 0, chatSeenIds = new Set(), lastChatSend = 0;
  const bootT = Date.now() / 1000;
  let trades = [], ladderDocs = [], ladderCat = "level", tradeSel = [], tradeTo = null, seenTrades = new Set(), lastLadderJson = "";
  let coopUI = null, ppUI = null, lvUI = null, pvUI = null, perkSkill = null, heroSkill = null, alchSel = [], party = null, invites = [], chests = [], news = [], seenAttacks = new Set(), lastCardJson = "", lastAmbushCheck = 0;
  const app = $("#app"), tabsEl = $("#tabs");
  const bump = () => { version++; };

  // ------------------------------------------------------------ helpers
  const hudIcon = (k, fallback) => (typeof HUD !== "undefined" ? HUD.icon(k) : fallback);
  const CQ = typeof CRAFTQOL !== "undefined" ? CRAFTQOL : null;   // crafting shortcuts (craftqol.js)
  /* [notify] loot, gold, skill and quest lines take turns through notify.js (merged, never on top of a blocking screen); plain messages show at once */
  function toast(text) { if (typeof NOTIFY !== "undefined") NOTIFY.msg(text, showToast); else showToast(text); }
  function showToast(text, o) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    if (o && o.replace) el.dataset.last = text;   // a merged line ("×3") replaces itself instead of pushing the old one down the log
    if (typeof HUD !== "undefined") HUD.log(el, text);
    el.textContent = text; el.classList.remove("hide");
    if (typeof POLISH !== "undefined") POLISH.toast(el, text);
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hide"), 3800);
  }
  function persist(pub = false) { Store.save(S); if (pub) { publishCard(); publishHome(); publishClan(); publishHall(); publishSide(); } bump(); }
  let lastClanJson = "";
  function publishClan() {
    const cl = S.clan || S.clanOld || null;   // sides.js: old clan members keep their record (their old guild hall still knows them)
    const json = JSON.stringify([cl, S.name]);
    if (json === lastClanJson) return; lastClanJson = json;
    if (cl) Store.put("clanmem", S.id, { clan: cl, name: S.name, t: G.now() }); else Store.remove("clanmem", S.id);
  }
  /* sides.js: your side, level and rank XP for everyone (one record per player, "sides") */
  let lastSideJson = "";
  function publishSide() {
    if (typeof SIDES === "undefined") return;
    const rec = SIDES.record(S), json = JSON.stringify(rec ? { ...rec, t: 0 } : null);
    if (json === lastSideJson) return; lastSideJson = json;
    if (rec) Store.put("sides", S.id, rec); else Store.remove("sides", S.id);
    SIDES.setDocs(null, S);
  }
  function publishCard(force = true) {
    const tr = S.trip;
    const card = { name: S.name, race: S.race, level: S.level, x: S.x, y: S.y,
      t0: tr ? tr.lastTick : G.now(), moving: !!(tr && tr.status === "travel"), dest: tr ? tr.dest : null,
      path: tr && tr.status === "travel" ? [[S.x, S.y], ...tr.path.slice(tr.idx + 1)].slice(0, 120) : null,
      speed: G.speed(S), loc: S.location || null, region: WORLD.regionOf([S.x, S.y]), look: HEROART.lookOf(S), ride: HORSES.riding(S) ? HORSES.coat(S.horse.coat)[2] : null, party: party?.id || null, hiding: !!S.ambush, facing: S.facing ?? null, ...(typeof SNEAKMODE !== "undefined" ? SNEAKMODE.cardBits(S) : {}), clan: myClan()?.tag || null, ...(typeof SIDES !== "undefined" ? SIDES.cardBits(S) : {}), ...MP.stats(S), coop: coopUI?.card() || null, ...(typeof PARTY !== "undefined" ? PARTY.cardBits(S, party) : {}), ...(typeof LIVING !== "undefined" ? LIVING.cardBits(S, party) : {}), ...(typeof LEVELUP !== "undefined" ? LEVELUP.cardBits(S) : {}), ...(typeof AFFL !== "undefined" ? AFFL.cardBits(S) : {}), ...(typeof FRIENDJOIN !== "undefined" ? FRIENDJOIN.bits(S, party) : {}), ...(typeof AVATAR !== "undefined" ? AVATAR.cardBits(S) : {}), ...(typeof SAMEVER !== "undefined" ? SAMEVER.cardBits() : {}) };
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
  /* fog of war (sneakmode.js): can I see this hero? party and friends always unless they sneak; hiding = right next to them */
  let myCone = null;   // your cone of sight on the map this frame (vision.js)
  function seesHero(o, t = G.now(), wide = false) {
    const d = G.pxDist(livePos(), otherPos(o, t));
    if (o.hiding) return d < MP.NEAR_PX;
    if (party?.members.some((m) => m.id === o.id)) return true;
    if (o.loc && S && o.loc === S.location) return true;
    if (typeof SNEAKMODE === "undefined") return true;
    if (o.sneaking) return d <= SNEAKMODE.seenWithin(o);
    if (myCone && typeof VISION !== "undefined" && VISION.inCone(myCone, otherPos(o, t))) return true;   // further off, but right in front of you (vision.js)
    return wide || (typeof SOCIAL !== "undefined" && SOCIAL.isFriend?.(S, o.id)) || d <= SNEAKMODE.SIGHT_PX;
  }
  function otherPos(o, t = G.now()) {
    if (!o.moving || !o.path || o.path.length < 2) return [o.x, o.y];
    return Terrain.moveAlong(o.path, 0, o.path[0], Math.max(0, t - o.t0), (o.speed || 30) / 60).pos;
  }
  /* the road a party member has walked so far on their trip (the map lines the party up behind its leader on it: partytrain.js) */
  function otherTrail(o, t = G.now()) {
    if (!o.moving || !o.path || o.path.length < 2) return null;
    const r = Terrain.moveAlong(o.path, 0, o.path[0], Math.max(0, t - o.t0), (o.speed || 30) / 60);
    return [...o.path.slice(0, r.idx + 1), r.pos];
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
    toast(` Discovered: ${fresh.slice(0, 2).join(", ")}${fresh.length > 2 ? ` and ${fresh.length - 2} more` : ""} · ${pf.got}/${pf.all} places`);
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
    if (typeof ACCOUNT !== "undefined") ACCOUNT.init({ getSave: () => S, onTitle: () => !!$("#title"), rerender: () => { if ($("#title") && titlePage === "account") renderTitle(); } });   // [OURS] accounts (account.js)
    if (getPref("zoomFar", false)) zoom = 1;
    let open = null; try { open = sessionStorage.getItem("rotn_open"); sessionStorage.removeItem("rotn_open"); } catch { /* ignore */ }
    if (open === "update") { showTitle("update"); checkUpdate(true); } else showTitle(open === "menu" ? "menu" : "press");
  }

  function showCreate() {
    const status = () => `<p class="sub status ${net.mode === "shared" || net.mode === "p2p" ? "live" : ""}" style="margin-top:10px"><i></i>${net.mode === "shared" ? "Shared world: other players will see you on the map." : net.mode === "p2p" ? "One world for everyone with the app: your game is saved on this phone and syncs straight with everyone else's." : APP ? "Offline game: saved on this phone." : "Saved in this browser only (shared saving unavailable here)."}</p>${net.mode === "shared" || net.mode === "p2p" ? "" : onlineBtn().replace('data-act="online"', 'id="online"')}`;
    // [OURS] character creation, Skyrim RaceMenu style (chargen.js)
    CHARGEN.create(app, {
      toast, startExtra: status,
      afterRender: (root) => { const b = root.querySelector("#online"); if (b) b.onclick = openOnline; },
      onBack: () => { app.innerHTML = ""; showTitle("menu"); },
      onBegin: ({ name, race, app: look, stone, avatar }) => {
        S = G.newSave(Store.uid, name, race);
        APPEAR.apply(S, look);   // the face you made (appear.js)
        if (typeof AVATAR !== "undefined") AVATAR.set(S, avatar);   // the portrait you picked ("" = Automatic)
        if (stone && POWERS.STONES[stone]) { S.stone = stone; S.stonePowerAt = 0; }   // the Guardian Stone you picked: its skills improve 20% faster
        if (typeof PATCHNOTES !== "undefined") PATCHNOTES.markSeen();   // a new character starts on the current version
        if (!/[?&]notut/.test(location.search)) S.tut = { step: 1, seen: {} };   // new characters get the guided first trip
        const wantIntro = !/[?&]notut/.test(location.search) && (!navigator.webdriver || /[?&]intro/.test(location.search));
        if (wantIntro) S.introSeen = true;
        persist(true);
        startGame();
        if (wantIntro) try { TITLEART.intro(null, { reduce: reduceMotion }); } catch (e) { console.warn("intro", e); }
      },
    });
  }
  /* the barber at an inn (small fee) and the mirror in your house (free): the same screen without Race and Start (chargen.js) */
  function openLookChange(mode) {
    CHARGEN.open({ mode, save: S, cost: CHARGEN.BARBER_COST, toast,
      onDone: (look) => {
        if (mode === "barber") { const r = CHARGEN.pay(S, look); if (r.err) return toast(r.err); toast(r.text); }
        else { APPEAR.apply(S, look); toast("You like what you see."); }
        lookCache.k = ""; persist(true); renderPanel(true);
      } });
  }

  /* [remake] a hero made before women heroes and the new looks: "Make your hero anew" once, at a quiet moment on the map
     (not in a fight, a dungeon, a party run or vote, a trade or a mini-game); remake.js does the race swap */
  let remakeOpen = false;
  function remakeCheck() {
    if (remakeOpen || !S || typeof REMAKE === "undefined" || !REMAKE.pending(S) || !gameStarted || document.querySelector(".cg-over")) return;
    if (!REMAKE.quiet({ S, title: !!$("#title"), voting: () => !!(pvUI && pvUI.showing && pvUI.showing()), safe: () => window.__ui.safeToUpdate() })) return;
    remakeOpen = true;
    const done = (text) => { remakeOpen = false; lookCache.k = ""; persist(true); publishCard(true); try { renderTop(); } catch { /* top bar redraws later */ } renderPanel(true); toast(text); };
    CHARGEN.open({ mode: "remake", save: S, toast,
      onDone: (o) => { const was = S.race; REMAKE.finish(S, o); done(was !== S.race ? `You are ${S.name} the ${D.RACES[S.race].name} now. Your race's skill boost moved with you; everything you trained stays.` : `You are ${S.name}, made anew.`); },
      onKeep: () => { REMAKE.keep(S); done("Your hero stays as they are. The barber or your mirror can change your look later."); } });
  }

  // ------------------------------------------------------------ title screen (main menu)
  const PREFS_KEY = "rotn_prefs";
  const getPref = (k, d) => { try { const v = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } };
  const setPref = (k, v) => { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); p[k] = v; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  let titlePage = "press", titleAnim = 0, update = null, updateMsg = "", updatePct = -1, updateBusy = false, gameStarted = false;
  /* [smallpolish] the title emblem is the app icon (icon.svg) inked in gold: a horned Nord helm under the northern star */
  const EMBLEM = `<svg class="emb" viewBox="0 0 1024 1024" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e7c4"/><stop offset=".6" stop-color="#c9a75e"/><stop offset="1" stop-color="#7d6230"/></linearGradient></defs>
    <circle cx="512" cy="512" r="470" fill="rgba(10,14,20,.35)" stroke="url(#eg)" stroke-width="16"/><circle cx="512" cy="512" r="418" fill="none" stroke="url(#eg)" stroke-width="7" stroke-dasharray="18 34"/>
    <path d="M512 130 L529 214 L613 231 L529 248 L512 332 L495 248 L411 231 L495 214 Z" fill="url(#eg)"/>
    <g fill="url(#eg)"><path d="M352 540 C236 546 162 456 172 292 C210 390 264 442 364 436 Z"/><path d="M672 540 C788 546 862 456 852 292 C814 390 760 442 660 436 Z"/>
    <path d="M332 610 C332 434 412 332 512 332 C612 332 692 434 692 610 L692 726 Q692 796 632 812 L590 822 C590 750 574 700 540 690 L540 810 L484 810 L484 690 C450 700 434 750 434 822 L392 812 Q332 796 332 726 Z"/></g>
    <g fill="#141a22"><path d="M394 610 Q452 574 494 600 L494 656 Q446 670 400 644 Z"/><path d="M630 610 Q572 574 530 600 L530 656 Q578 670 624 644 Z"/></g>
    <path d="M342 558 Q512 516 682 558" fill="none" stroke="#141a22" stroke-width="14"/><path d="M512 344 L512 534" fill="none" stroke="#141a22" stroke-width="12"/></svg>`;
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
      el.innerHTML = `<canvas id="tanim" class="tanim" aria-hidden="true"></canvas><canvas id="tfog"></canvas><div class="vign"></div><div class="inner" id="tinner"></div>`;
      document.body.appendChild(el);
      el.addEventListener("click", onTitleClick);
      el.addEventListener("input", onSettingsInput);
      el.addEventListener("change", onSettingsInput);
      const fog = startFog();   // the fog and snow are painted in step with the panorama behind them (one wake-up per frame)
      try { titleStop = TITLEART.start($("#tanim"), { reduce: reduceMotion, onFrame: fog }); } catch (e) { console.warn("title art", e); fog.loop(); }
      setTimeout(shineRest, 300);
      /* [smallpolish] the version and world line lives in Settings now, not under the title */
      const foot = async () => { if (!$("#title")) return; const t = `${await versionText()} · ${worldText()}`, v = $("#tver"); if (v) v.textContent = t; setTimeout(foot, 3000); };
      foot();
    }
    tabsEl.classList.add("hide");
    SOUND.mood("title");
    SOUND.ambience?.({ scene: "title" });   // the title: music only, no wind or other background noise
    renderTitle();
  }
  let titleStop = null;
  /* [perf] the light sweeping over the title (CSS "tshine": 7 s a round, still for the first 60%) can't run on the graphics
     chip, so the page restyled and repainted the title every refresh even while the sweep sat still. Pause it for the
     still part and jump straight to where it moves again: it looks exactly the same */
  function shineRest() {
    const h1 = document.querySelector("#title h1"), a = h1?.getAnimations?.().find((x) => x.animationName === "tshine");
    if (!a || a.effect?.getTiming?.().iterations !== Infinity) return;
    const tm = a.effect.getTiming(), delay = +tm.delay || 0, dur = +tm.duration || 0, still = dur * 0.6;
    if (!dur) return;
    const step = () => {
      if (!h1.isConnected || !$("#title")) return;
      const ct = Number(a.currentTime) || 0;
      if (ct < delay) { setTimeout(step, delay - ct + 20); return; }
      const local = (ct - delay) % dur;
      if (local < still) {   // sitting still: pause, and later carry on from where the sweep starts
        a.pause();
        setTimeout(() => { if (!h1.isConnected) return; a.currentTime = ct - local + still; a.play(); setTimeout(step, dur - still + 30); }, still - local);
      } else setTimeout(step, dur - local + 30);
    };
    step();
  }
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
    if (!$("#thead")) { inner.innerHTML = `<div id="thead" style="display:flex;flex-direction:column;align-items:center">${typeof TITLELOGO !== "undefined" ? TITLELOGO.html() : EMBLEM + "<h1>Roads of the North</h1>"}<div class="tag">A shared journey across Skyrim</div></div><div id="tbody" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1"></div>`; if (typeof TITLELOGO !== "undefined") TITLELOGO.mount(inner.querySelector(".tlogo")); }
    let body = "";
    if (titlePage === "press") body = `<button class="press" data-t="menu">Tap to begin</button>`;
    else if (titlePage === "menu") {
      const item = (t, label, sub = "", badge = "") => `<button class="mi" data-t="${t}"><span class="lbl">${label}${badge ? `<span class="badge">${badge}</span>` : ""}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
      body = `<nav class="menu" aria-label="Main menu">
        ${S ? item("continue", "Continue", `${S.name} · Level ${S.level} ${D.RACES[S.race].name} · ${S.location || G.holdAt([S.x, S.y])}`) : ""}
        ${item("new", S ? "New Character" : "Begin")}
        ${typeof ACCOUNT !== "undefined" && ACCOUNT.on() ? item("account", ACCOUNT.signedIn() ? "Account" : "Sign in", ACCOUNT.menuSub()) : ""}
        ${item("settings", "Settings")}
        ${item("update", "Updates", "", updNewer() ? "New" : "")}
        ${typeof PATCHNOTES !== "undefined" ? item("notes", "Patch Notes", "", PATCHNOTES.unseen() && S ? "New" : "") : ""}
        ${item("howto", "How to Play")}
        ${item("credits", "Credits")}</nav>`;
    }
    else body = `<div class="page">${titleSubpage()}</div>`;
    $("#tbody").innerHTML = body;
    if (titlePage !== "press") inner.querySelector(".mi, .page .btn")?.focus({ preventScroll: true });
    if (titlePage !== "menu" && titlePage !== "press") inner.scrollTop = 0;
    // the phone app's updater counts these game files as working only once the title has drawn (app.js)
    if (!window.__rotnTitleDrawn) { window.__rotnTitleDrawn = true; try { window.__app?.ready?.(); } catch { /* web version */ } }
  }
  const backBtn = `<button class="btn" data-t="menu">Back</button>`;
  function titleSubpage() {
    if (titlePage === "settings") return `<h2>Settings</h2><p class="sub tver" id="tver">${APP ? "App" : "Web version"} · ${esc(worldText())}</p>${settingsHTML()}${typeof PATCHNOTES !== "undefined" ? `<button class="btn" data-t="notes" style="width:100%;margin-top:12px"> Patch notes</button>` : ""}${backBtn}`;
    if (titlePage === "notes") { PATCHNOTES.markSeen(); return `${PATCHNOTES.barHTML("page", 'data-t="menu"')}${PATCHNOTES.html()}${backBtn}`; }
    if (titlePage === "account" && typeof ACCOUNT !== "undefined") return `${ACCOUNT.pageHTML()}${backBtn}`;
    if (titlePage === "confirmNew") return `<h2>Start over?</h2><p>${(typeof ACCOUNT !== "undefined" && ACCOUNT.newCharText(S)) || `${esc(S.name)} (level ${S.level}) and everything they carry will be gone for good. Other players' worlds aren't affected.`}</p>
      <button class="btn danger" data-t="wipe">Yes, make a new character</button>${backBtn}`;
    if (titlePage === "update") return `<h2>Updates</h2>${updateHTML()}${backBtn}`;
    if (titlePage === "backup") return `<h2>Back up</h2>${backupHTML()}<button class="btn" data-t="settings">Back</button>`;
    if (titlePage === "restore") return `<h2>Restore</h2>${restoreHTML()}<button class="btn" data-t="settings">Back</button>`;
    if (titlePage === "howto") return `<h2>How to Play</h2>
      <h3>Travel</h3><p>Tap a place on the map and press Go. You walk in real time, even with the app closed: about ten minutes from Whiterun to Windhelm. Roads are fast; snow, marsh and mountains are slow. Carriages are safe and quick.</p>
      <h3>Fights</h3><p>Bandits, wolves and worse block the road. Fight, flee, sneak past or drink a potion. You play every fight yourself, turn by turn.</p>
      <h3>Towns</h3><p>The Area tab has shops, inns, trainers, the forge, alchemy, jobs, homes and followers. Rest at an inn or your own bed for a bonus.</p>
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
    if (!(t === "menu" && titlePage === "press")) SOUND.fx("click");   // "Tap to begin" stays silent
    switch (t) {
      case "continue": closeTitle(); startGame(); break;
      case "tutorial": S.tut = { step: 1, seen: {} }; Store.save(S); closeTitle(); startGame(); break;
      case "new": if (S) { titlePage = "confirmNew"; renderTitle(); } else { closeTitle(); showCreate(); } break;
      case "wipe": if (typeof ACCOUNT !== "undefined" && ACCOUNT.signedIn() && ACCOUNT.linked()) { ACCOUNT.newCharacter(); break; }   // signed in: the old one stays on the account, the new one gets its own id
        Store.wipe().then(() => { S = null; closeTitle(); showCreate(); }); break;
      case "update": titlePage = "update"; renderTitle(); checkUpdate(true); break;
      case "doupdate": runUpdate(); break;
      case "sameready": SV()?.restartNow(); break;
      default: titlePage = t; renderTitle();
    }
  }
  function startGame() { if (gameStarted) return; gameStarted = true; start(); if (typeof NICK !== "undefined" && NICK.needs(S)) NICK.prompt(S, (n) => { persist(true); toast(`Welcome, ${n}.`); try { renderTop(); } catch { /* top bar redraws later */ } }); }

  // ---- settings (title page and in-game sheet share these)
  function settingsHTML() {
    const c = SOUND.settings, sl = (id, label, v) => `<label class="sndrow"><span>${label}</span><input type="range" id="${id}" min="0" max="100" step="5" value="${Math.round(v * 100)}" aria-label="${label}"></label>`;
    const seg = (key, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-act="pref" data-k="${key}" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join("")}</div>`;
    return `<h3>Sound</h3>${sl("snd_music", "Music", c.music)}${sl("snd_sfx", "Effects", c.sfx)}${sl("snd_amb", "Ambience", c.amb ?? 0.5)}
      <div class="setrow"><span>All sound</span>${seg("mute", [[false, "On"], [true, "Off"]], c.mute)}</div>
      ${S ? `<h3>Your character</h3><div class="chatrow" style="margin-bottom:8px"><input id="myname" maxlength="24" autocomplete="off" value="${esc(S.name)}" aria-label="Your name"><button class="btn" data-act="rename">Change name</button></div><div class="grid2"><button class="btn" data-act="bk" data-bk="openbackup">Back up</button><button class="btn" data-act="bk" data-bk="openrestore">Restore</button></div>` : `<h3>Your character</h3><button class="btn" data-act="bk" data-bk="openrestore" style="width:100%">Restore from a backup</button>`}
      ${typeof I18N !== "undefined" ? `<h3>Language</h3>${I18N.settingRow(seg)}` : ""}
      <h3>Look</h3>
      ${typeof LIGHTFX !== "undefined" ? LIGHTFX.settingsHTML(seg) : ""}
      ${typeof PAINTEDMAP !== "undefined" ? PAINTEDMAP.settingsHTML(seg) : ""}
      ${typeof MOTION !== "undefined" ? `<div class="setrow"><span>Motion</span>${seg("motion", [["full", "Full"], ["lite", "Lite"], ["off", "Off"]], MOTION.pref())}</div>` : ""}
      ${typeof TB !== "undefined" ? `<h3>Fights</h3>${typeof GORE !== "undefined" ? GORE.settingsHTML(seg) : typeof COMBATFX !== "undefined" ? `<div class="setrow"><span>Blood</span>${seg("gore", [[true, "On"], [false, "Off"]], getPref("gore", true))}</div>` : ""}` : ""}${typeof FIGHTCTL !== "undefined" && typeof TB !== "undefined" ? FIGHTCTL.settingsHTML(seg) : ""}${typeof COMBAT2 !== "undefined" && typeof TB !== "undefined" ? COMBAT2.settingsHTML(seg) : ""}${typeof FIGHTSET !== "undefined" && typeof TB !== "undefined" ? FIGHTSET.settingsHTML(seg) : ""}${typeof FASTQOL !== "undefined" ? FASTQOL.settingsHTML(seg) : ""}
      ${typeof ACCESS !== "undefined" ? ACCESS.settingsHTML(seg) : ""}
      ${typeof ONBOARD !== "undefined" ? ONBOARD.settingsHTML(seg) : ""}
      ${typeof BUGREPORT !== "undefined" ? BUGREPORT.settingsHTML() : ""}
      <h3>Crafting</h3><div class="setrow"><span>When you craft</span>${seg("craftGame", [[true, "Mini-games"], [false, "Quick craft"]], getPref("craftGame", true))}</div>${typeof LOCKGAME !== "undefined" ? `<div class="setrow"><span>When you pick a lock</span>${seg("lockGame", [[true, "Mini-game"], [false, "Quick pick"]], getPref("lockGame", true))}</div>` : ""}
      ${S && typeof WFX !== "undefined" ? `<h3>Survival</h3><div class="setrow"><span>Cold meter</span>${seg("survival", [[true, "On (gentle)"], [false, "Off"]], S.survival !== false)}</div>` : ""}
      <h3>Map</h3><div class="setrow"><span>Map opens</span>${seg("zoomFar", [[false, "Close up"], [true, "All Skyrim"]], getPref("zoomFar", false))}</div>${typeof PCMAP !== "undefined" ? PCMAP.settingsHTML(seg) : ""}
      ${APP ? `<h3>Phone</h3><div class="setrow"><span>Notifications</span>${seg("notify", [[true, "On"], [false, "Off"]], getPref("notify", true))}</div>${typeof REMIND !== "undefined" ? REMIND.settingsHTML(seg) : ""}
      <p class="mute" style="font-size:13px">Updates download and install by themselves, at a quiet moment (never mid-fight, in a dungeon or a trade).</p>` : ""}`;
  }
  function onSettingsInput(e) {
    if (typeof FIGHTSET !== "undefined" && FIGHTSET.input(e.target)) return;   // Fights → Camera shake, Fight UI size (fightset.js)
    if (e.target.id === "snd_music") SOUND.set("music", e.target.value / 100);
    if (e.target.id === "snd_amb") SOUND.set("amb", e.target.value / 100);
    if (e.target.id === "snd_sfx") { SOUND.set("sfx", e.target.value / 100); if (e.type === "change") SOUND.fx("coin"); }
  }
  /* returns true when the caller should re-render */
  function settingsAction(act, b) {
    if (act !== "pref") return false;
    const k = b.dataset.k, v = b.dataset.v === "true";
    if (typeof I18N !== "undefined" && I18N.pref(k, b.dataset.v)) return true;
    if (typeof ACCESS !== "undefined" && ACCESS.pref(k, b.dataset.v)) { SOUND.fx("click"); return true; }
    if (typeof ONBOARD !== "undefined" && ONBOARD.pref(k, b.dataset.v)) { SOUND.fx("click"); if (S) { try { renderPanel(true); } catch { /* title */ } } return true; }
    if (typeof FIGHTSET !== "undefined" && FIGHTSET.pref(k, b.dataset.v)) { SOUND.fx("click"); return true; }   // Fights → Fight quality, Frame rate (fightset.js)
    if (typeof GORE !== "undefined" && GORE.pref(k, b.dataset.v)) { SOUND.fx("click"); return true; }   // Fights → Blood and gore: Off / Low / Full (gore.js)
    if (typeof FASTQOL !== "undefined" && FASTQOL.pref(k, b.dataset.v)) { SOUND.fx("click"); return true; }   // replay speed, carry on after road events
    if (k === "survival") { if (S) { S.survival = v; if (!v) S.coldV = 0; persist(); try { renderPanel(true); } catch { /* title */ } } SOUND.fx("click"); return true; }
    if (typeof PAINTEDMAP !== "undefined" && PAINTEDMAP.pref(k, b.dataset.v)) { SOUND.fx("click"); if (S) { try { renderPanel(true); } catch { /* title screen */ } } return true; }   // Graphics → Roads on the map (paintedmap.js)
    if (typeof PCMAP !== "undefined" && PCMAP.pref(k, b.dataset.v)) { SOUND.fx("click"); return true; }   // Map → Map quality (pcmap.js, mapfx.js)
    if (typeof LIGHTFX !== "undefined" && LIGHTFX.pref(k, b.dataset.v)) { SOUND.fx("click"); if (S) { try { renderPanel(true); } catch { /* title screen */ } } return true; }   // Graphics → Lighting
    if (k === "motion") { MOTION.setPref(b.dataset.v); SOUND.fx("click"); return true; }
    if (k === "mute") { SOUND.set("mute", v); if ($("#sndBtn")) $("#sndBtn").innerHTML = hudIcon(v ? "mute" : "gear", v ? "\uE195" : "\uE11E") + '<small class="ibl" aria-hidden="true">Menu</small>'; }
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

  // ---- updates: one newest build for everyone (samever.js holds the state: your build, the newest, downloads, errors)
  let updateHow = "";
  const SV = () => (typeof SAMEVER !== "undefined" ? SAMEVER : null);
  const updNewer = () => !!(update?.newer || (SV() && SV().state.latest > SV().state.mine && SV().state.mine));
  function updateHTML() {
    const sv = SV(), st = sv ? sv.state : { mine: 0, latest: 0 }, web = !window.__app;
    if (window.__app?.how && !updateHow) window.__app.how().then((t) => { updateHow = t; if (titlePage === "update") renderTitle(); }).catch(() => {});
    const mine = update?.current?.build || st.mine, latest = update?.latest?.build || st.latest;
    const row = (label, v) => `<p>${label} <b>${v ? `build ${v}` : "…"}</b></p>`;
    const head = `<div class="upd-st" id="updst">${row(web ? "Web version:" : "Your version:", mine)}${row("Newest version:", latest)}</div>`;
    const howLine = updateHow ? `<p class="sub">${esc(updateHow)}</p>` : "";
    const again = `<button class="btn" data-t="update">Check again</button>`;
    // what's happening right now
    if (st.dl) return `${head}<p id="umsg">${st.dl.pct >= 0 ? `Updating: downloading build ${st.dl.build}… ${st.dl.pct}%` : `Updating to build ${st.dl.build}…`}</p><div class="uprog"><i id="ubar" style="width:${Math.max(3, st.dl.pct)}%"></i></div>${howLine}`;
    if (st.ready) return `${head}<p>Build ${st.ready.build} is ready. The game switches over now (your progress is saved).</p><button class="btn pri" data-t="sameready">${st.ready.web ? "Reload now" : "Restart now"}</button>${howLine}`;
    if (st.checking && !update) return `${head}<p class="sub">Checking for a new version…</p>`;
    // a failed check shows its reason and Retry, even when an earlier check worked
    const errLine = st.err ? `<p class="err">Couldn't check for a new version (${esc(st.err)}). Check your internet.</p>` : "";
    const retry = st.err ? `<button class="btn pri" data-t="update">Retry</button>` : again;
    if (!updNewer()) return `${head}${errLine || `<p>You have the newest version. Everyone you play with is on the same build once they've updated too.</p>`}${howLine}${retry}`;
    if (web) return `${head}<p>A new version is out: <b>build ${latest}</b></p><p>Reload to play it: your progress is saved.</p><button class="btn pri" data-t="doupdate">Reload now</button>`;
    const lat = update.latest, when = lat.date ? new Date(lat.date).toLocaleDateString() : "";
    return `${head}<p>A new version is ready: <b>build ${lat.build}</b>${when ? ` (${esc(when)})` : ""}.</p>
      ${lat.notes ? `<h3>What's new</h3><div class="notes">${esc(lat.notes)}</div>` : ""}
      <p class="sub">Your character and progress stay. ${((update.size || lat.size) / 1048576).toFixed(1)} MB download${update.quick ? ", no reinstall: the game just restarts" : ""}.</p>
      ${updateMsg ? `<p id="umsg">${esc(updateMsg)}</p><div class="uprog"><i id="ubar" style="width:${Math.max(0, updatePct)}%"></i></div>` : ""}
      ${howLine}<button class="btn pri" data-t="doupdate" ${updateBusy ? "disabled" : ""}>${updateBusy ? "Updating…" : "Update now"}</button>`;
  }
  /* "Check again" / Retry: really asks again (the app's and PC's updater skip their cache; the web asks our server) */
  async function checkUpdate(force) {
    if (!SV()) return;
    if (force) { updateMsg = ""; if (window.__app) update = null; }
    if (titlePage === "update") renderTitle();
    try { const r = await SV().check(force); if (window.__app) update = r; }
    catch (err) { update = null; } // SAMEVER keeps the reason in state.err; the page shows it with Retry
    if ($("#title")) renderTitle();
  }
  async function runUpdate() {
    if (!window.__app) { const sv = SV(); if (sv && sv.state.latest > sv.state.mine) sv.freshReload(sv.state.latest); return; }   // web: reload on the new files
    if (!update?.newer || updateBusy) return;
    updateBusy = true; updateMsg = "Starting…"; updatePct = 0; renderTitle();
    try {
      const r = await window.__app.install(update.latest, (text, pct) => {
        updateMsg = text; updatePct = pct;
        const m = $("#umsg"), bar = $("#ubar");
        if (m && bar) { m.textContent = text; bar.style.width = `${Math.max(0, pct)}%`; } else if (titlePage === "update") renderTitle();
      });
      if (r === "applied") updateMsg = "Restarting on the new version…";
      else if (r === "installer") updateMsg = "Tap Install (or Update) on Android's screen. The game reopens on the new version.";
    } catch (err) { updateMsg = `The update didn't finish: ${err.message}.`; }
    updateBusy = false;
    if (titlePage === "update") renderTitle();
  }
  /* the app / PC downloaded a newer build: the "Update ready" card (go() switches over; quiet: the PC shows its own card) */
  function updateStaged(r, go, quiet) {
    if (r) update = r;
    if (SV() && go) SV().ready(r?.latest?.build, go, { quiet: !!quiet });
    if ($("#title")) renderTitle();
  }
  /* background download progress (build 0 = it stopped; err says why) */
  function updateProgress(build, pct, err) {
    const sv = SV(); if (!sv) return;
    if (build > 0) sv.dl(build, pct); else { sv.dlDone(); if (err) sv.set({ err: String(err).slice(0, 140) }); }
  }
  let updRaf = 0;
  if (SV()) SV().onChange(() => {   // keep the Updates page and the menu's "New" badge true to what's happening
    if (updRaf || !$("#title")) return;
    updRaf = requestAnimationFrame(() => {
      updRaf = 0;
      const st = SV().state, m = $("#umsg"), bar = $("#ubar");
      if (titlePage === "update" && st.dl && m && bar) { m.textContent = st.dl.pct >= 0 ? `Updating: downloading build ${st.dl.build}… ${st.dl.pct}%` : `Updating to build ${st.dl.build}…`; bar.style.width = `${Math.max(3, st.dl.pct)}%`; return; }
      if (titlePage === "update" || titlePage === "menu") renderTitle();
    });
  });
  function updateAvailable(r) {
    update = r;
    if ($("#title")) { if (titlePage === "menu" || titlePage === "update") renderTitle(); return; }
    toast(`A new version (build ${r.latest.build}) is ready. Open  to update.`);
  }

  // ---- fog and snow
  function startFog() {
    const cv = $("#tfog"), cx = cv.getContext("2d");
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener("resize", fit);
    const W = () => innerWidth, H = () => innerHeight;
    const blobs = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * W(), y: H() * (0.35 + Math.random() * 0.7), r: 160 + Math.random() * 260, v: 6 + Math.random() * 12, a: 0.05 + Math.random() * 0.06, ph: i }));
    /* [perf] one soft fog blob painted once and stamped (scaled, faded) instead of building nine big gradients every frame */
    const puff = document.createElement("canvas"); puff.width = puff.height = 256;
    { const pg = puff.getContext("2d"), g = pg.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, "rgba(200,210,220,1)"); g.addColorStop(1, "rgba(200,210,220,0)"); pg.fillStyle = g; pg.fillRect(0, 0, 256, 256); }
    const flakes = Array.from({ length: 70 }, () => ({ x: Math.random() * W(), y: Math.random() * H(), s: 0.6 + Math.random() * 1.8, v: 12 + Math.random() * 30, w: Math.random() * 6 }));
    let last = performance.now();
    const draw = (ts) => {
      if (!$("#title")) return;
      const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
      cx.clearRect(0, 0, W(), H());
      for (const b of blobs) {
        if (!reduceMotion) { b.x += b.v * dt; if (b.x - b.r > W()) b.x = -b.r; }
        cx.globalAlpha = b.a; cx.drawImage(puff, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      cx.globalAlpha = 1;
      cx.fillStyle = "rgba(235,240,245,.55)";
      for (const f of flakes) {
        if (!reduceMotion) { f.y += f.v * dt; f.x += Math.sin(ts / 1000 + f.w) * 8 * dt; if (f.y > H()) { f.y = -4; f.x = Math.random() * W(); } }
        cx.beginPath(); cx.arc(f.x, f.y, f.s, 0, 7); cx.fill();
      }
    };
    /* without the panorama (it failed to start) the fog runs on its own, as before */
    draw.loop = () => { const step = (ts) => { if (!$("#title")) return; draw(ts); if (!reduceMotion) titleAnim = requestAnimationFrame(step); }; titleAnim = requestAnimationFrame(step); };
    return draw;
  }

  // ------------------------------------------------------------ main screen
  window.__dbg = { save: () => S, fightResult: (r) => showFightResult(r), view: () => view, openEvent: (n) => openEvent(n), openEncounter: (n) => openEncounter(n), tally: (k, n) => tally(k, n), message: (t, x, b) => showMessage(t, x, b), toast: (t) => toast(t), publish: () => publishCard(), others: () => others, party: () => party, pp: () => ppUI, coopRuns: () => coopUI?.runs || [], setView: (z, cn) => { zoom = z; if (cn) center = cn; follow = false; kickMap(); } };   // for testing in the browser console
  /* phone back button: close what's on top, step back to the map, and only then leave the app */
  /* opts.esc: the PC's Esc key (desktop.js). It walks the same steps, except that the compass isn't "home" on a PC and
     a fight isn't left alone: false then means "nothing left to close", and Esc opens the pause menu (pausemenu.js) */
  /* [qa-core] full-screen mini-games sit over everything, so the phone's back button used to reach the screens under them
     (and at last minimised the app) while the game stayed open. Press the game's own way out instead, as a player would */
  const GAME_EXITS = ["#fishgame #fhdone", "#huntgame #hglow", "#huntgame #hgfin", "#huntgame #hgdone", "#minegame #mgok", "#minegame #mgdone",
    "#lockpick #lpleave", "#pickgame #ppleave", "#smithgame #sgquick", "#craftgame #cgquick", "#xgame [data-act=close]"];
  function backOutOfGame() {
    for (const sel of GAME_EXITS) { const b = document.querySelector(sel); if (b && !b.disabled && b.offsetParent !== null) { b.click(); return true; } }
    const rc = $("#rct"); if (rc) { rc.click(); return true; }   // runecraft.js closes when its backdrop is tapped
    return false;
  }
  window.__ui = {
    back(opts) {
      const escKey = !!(opts && opts.esc);
      if (typeof PAUSEM !== "undefined" && PAUSEM.isOpen()) { PAUSEM.close(); return true; }   // the Esc menu is the very top
      if (typeof BUGREPORT !== "undefined" && BUGREPORT.isOpen()) { BUGREPORT.close(); return true; }   // the report window sits on top of everything
      if (typeof NOTIFY !== "undefined" && NOTIFY.closeHist()) return true;   // [notify] the message history
      if (S && typeof CHARGEN !== "undefined" && document.querySelector(".cg-over")) { CHARGEN.close(false); return true; }   // [qa-core] the barber / mirror: back = Cancel, never something hidden under it
      { const x = backOutOfGame(); if (x) return x; }   // [qa-core] a mini-game or the rune table: back leaves it (its own Leave / Done button)
      if ($("#title")) { if (titlePage !== "menu" && titlePage !== "press") { titlePage = "menu"; renderTitle(); return true; } return false; }
      if (!S && $("#toTitle")) { app.innerHTML = ""; showTitle("menu"); return true; }
      if (typeof TB !== "undefined" && TB.open) { if ($("#modal.pm-top")) { closeModal(); return true; } return !escKey; }   // a turn-based fight is on: finish it (or Flee); Esc pauses
      if (typeof FAVWHEEL !== "undefined" && FAVWHEEL.open) { FAVWHEEL.hide(); return true; }
      if (typeof LEVELUP !== "undefined" && LEVELUP.isOpen) { LEVELUP.close(); return true; }   // the level-up pillars: decide later
      if ($("#sky") && !$("#modal") && escKey && sky.page === "items" && sky.sel != null && typeof ITEMCMP !== "undefined" && ITEMCMP.side($("#sky"))) { sky.sel = null; renderMenu(); return true; }   // [itemdetail] Esc lets go of the pinned item first
      if ($("#sky") && !$("#modal")) { closeMenu(); if (typeof TABMENU !== "undefined") TABMENU.menuClosed(); return true; }
      if ($("#modal")) { if (!$("#modal [data-act=enc], #modal [data-act=ev], #modal [data-act=guard]")) closeModal(); return true; }
      if (typeof MAPSHEET !== "undefined" && MAPSHEET.isOpen()) { MAPSHEET.close(); selected = null; return true; }   // [map-panels] a caravan's, place's or hero's panel: back closes it
      if (typeof LOCSCREEN !== "undefined" && LOCSCREEN.closeSheet()) return true;   // a card open on the place's scene
      if (typeof DWEMER !== "undefined" && DWEMER.closeOv()) return true;   // a lexicon / valve puzzle (dwemer.js)
      if (typeof BLACKREACH !== "undefined" && BLACKREACH.close()) return true;   // the Blackreach map (blackreach.js)
      if ($("#dun")) { closeDungeon(); return true; }
      if (selected) { selected = null; renderPicked(); return true; }
      if (S && (tab === "stats" || tab === "diary") && !document.body.classList.contains("tw-char")) { tab = "hero"; renderTabs(); renderPanel(true); return true; }   // [journal] Character sub-pages
      if (S && tab === "places") { tab = "map"; renderTabs(); renderPanel(true); return true; }
      if (S && tab === "town" && townShop && $("#side .au-back")) { townShop = ""; renderPanel(true); return true; }   // [qa-core] in a shop or the inn: back goes to the town's board first, like its ‹ button
      if (typeof TABMENU !== "undefined") { const r = TABMENU.back(opts); if (r !== null) return r; }   // the compass is home (tabmenu.js); on a PC the map is
      if (S && tab !== "map") { tab = "map"; bump(); renderTabs(); renderPanel(true); return true; }
      return false;
    },
    save() { if (S) Store.save(S); },
    /* for the Esc menu (pausemenu.js) */
    inGame: () => !!S && !$("#title"),
    settings: () => { if (S) openSound(); },
    notes: () => { if (typeof PATCHNOTES !== "undefined") openNotes(); },
    guide: () => { if (S) { openGuide(); persist(); } },
    toTitle() { if (S) Store.save(S); try { sessionStorage.setItem("rotn_open", "menu"); } catch { /* ignore */ } location.reload(); },
    /* is this a good moment to restart on a new version? not mid-fight, dungeon, trade, menu, mini-game or typing */
    safeToUpdate() {
      const el = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName || "") || el?.isContentEditable;
      if (typing) return false;
      if ($("#title")) return true;
      if (!S || S.dungeon || S.trip?.event || S.encounter) return false;
      if (["modal", "tbf", "tbwatch", "lockpick", "pickgame", "sky", "tw", "nickbox", "breach", "dwgame", "bugrep", "lvlpick"].some((id) => document.getElementById(id))) return false;
      // any mini-game on screen (fishing, mining, hunting, the forge, brewing, rune table, tourney games, dungeon locks...): a restart would lose the catch
      if (document.querySelector(".craftgame, .lockpick, .smithgame, .xgame, .rct-wrap, #exp-layer:not(:empty)")) return false;
      if ((coopUI?.runs || []).length) return false;
      return true;
    },
    /* pressing Restart now / Update (samever.js): fine in a menu (it saves first), never mid-fight, dungeon, event or mini-game */
    safeToRestart() {
      if ($("#title") || !S) return true;
      if (S.dungeon || S.trip?.event || S.encounter) return false;
      if (["tbf", "tbwatch", "lockpick", "pickgame", "breach", "dwgame", "lvlpick"].some((id) => document.getElementById(id))) return false;
      if (document.querySelector(".craftgame, .lockpick, .smithgame, .xgame, .rct-wrap, #exp-layer:not(:empty)")) return false;
      return true;
    },
    /* for the Tab compass (tabmenu.js) */
    openMenu: (p) => openMenu(p), closeMenu: () => closeMenu(), refresh: () => { bump(); renderPanel(true); }, fight: (r) => showFightResult(r), tbCall: (fn, done) => tbCall(fn, done),   // tbCall: event fights open the turn-by-turn screen (noautoplay.js)
    go(t) { closeMenu(); tab = t; bump(); renderTabs(); renderPanel(true); if (typeof MENUTOP !== "undefined") MENUTOP.top(); },   // a screen opens at its top
    get tab() { return tab; },
    /* [remind] Go buttons: open a screen ({ tab, shop, jtab, soc, anchor }) or pick a place on the map ({ place }) */
    remindData: () => ({ trades, stalls }),
    jump(o) {
      if (!S || !o) return false;
      closeModal(); closeMenu(); if (typeof TABMENU !== "undefined" && TABMENU.closeHub) { try { TABMENU.closeHub(); } catch { /* fine */ } }
      if (o.place && o.place !== S.location && WORLD.places[o.place]) {
        tab = "map"; selected = o.place; roamSpot = null; bump(); renderTabs(); renderPanel(true); renderPicked();
        $("#mapwrap")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); return true;
      }
      tab = o.tab || "map";
      if (o.shop) { townShop = o.shop; townShopAt = S && S.location; } if (o.jtab) jTab = o.jtab; if (o.soc) socTab = o.soc;
      bump(); renderTabs(); renderPanel(true);
      const el = (o.anchor && document.getElementById(o.anchor)) || $("#side");
      el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      return true;
    },
    updateAvailable: (r) => updateAvailable(r),
    updateStaged: (r, go, quiet) => updateStaged(r, go, quiet),
    updateProgress: (b, pct, err) => updateProgress(b, pct, err),
    permissionBack: () => { if ($("#title") && titlePage === "update") { updateMsg = "Thanks. Tap Update now again."; renderTitle(); } },
    /* things worth a phone notification while the app is closed: arrival and the next dragon attack (times in ms) */
    upcoming() {
      if (!S) return [];
      const out = [], now = Date.now(), tr = S.trip;
      if (tr && tr.status === "travel") { const m = tripMinutesLeft(); if (m > 0.5) out.push({ id: 1, at: now + m * 60000, title: `You've reached ${tr.destName}`, body: tr.carriage ? "The carriage pulls up. Tap to see where you are." : "Your trip is over. Tap to see what's there." }); }
      const r = WEVENTS.nextRaid();
      if (r) out.push({ id: 2, at: r.start * 1000, title: ` A dragon attacks ${r.town}!`, body: "Every player can fight it together for the next 20 minutes." });
      if (typeof REMIND !== "undefined") { try { out.push(...REMIND.notes(S, now)); } catch { /* reminders are optional */ } }   // remind.js
      return out.filter((n) => n.at > now + 5000);
    },
  };
  function start() {
    if (typeof POLISH !== "undefined") POLISH.texture();
    app.innerHTML = `
      <div class="top"><span class="lvlb num" id="lvlb" aria-label="Level"></span><div class="who"><b id="nm"></b><span id="sub"></span></div>
        <div class="meta"><div id="clock"></div><div class="gold" id="goldv"></div></div>
        ${typeof SEARCH !== "undefined" ? SEARCH.btn() : ""}
        <button class="iconbtn soc" id="socBtn" aria-label="Friends, messages and trades">${hudIcon("people", "")}<small class="ibl" aria-hidden="true">Friends</small></button>
        <button class="iconbtn snd" id="sndBtn" aria-label="Settings and menu">${hudIcon(SOUND.settings.mute ? "mute" : "gear", SOUND.settings.mute ? "" : "")}<small class="ibl" aria-hidden="true">Menu</small></button></div>
      <div class="layout">
        <div>
          <div class="mapwrap" id="mapwrap"><canvas id="map" aria-label="Map of Skyrim"></canvas>
            <div class="mapbtns">${typeof RIDING !== "undefined" ? RIDING.button(S) : ""}<button class="iconbtn" id="zoomBtn" aria-label="Zoom map">${zoom === 1 ? "＋" : "－"}</button><button class="iconbtn" id="centerBtn" aria-label="Centre on me">◎</button>${typeof HUNT !== "undefined" ? `<button class="iconbtn sneakbtn huntbtn${S?.hunting ? " on" : ""}" id="huntBtn" aria-label="Hunt" aria-pressed="${!!S?.hunting}" title="Hunt: slower, but you run into animals far more often"><svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="M6 3c5 3 5 15 0 18" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 3v18" stroke="currentColor" stroke-width="1" opacity=".7"/><path d="M4 12h15m0 0-3-3m3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>` : ""}${typeof SNEAKMODE !== "undefined" ? `<button class="iconbtn sneakbtn${S?.sneak ? " on" : ""}" id="sneakBtn" aria-label="Sneak" aria-pressed="${!!S?.sneak}" title="Sneak: slower, fewer fights, harder to spot"><svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg></button>` : ""}</div>
</div>
          <div class="vitals" id="vitals"></div>
          <div id="trip"></div>
          <div id="raid"></div>
        </div>
        <div class="side" id="side"></div>
      </div>`;
    tabsEl.classList.remove("hide");
    window.scrollTo(0, 0);
    if (!(typeof MENUS !== "undefined" && MENUS.bar(tabsEl, tab))) tabsEl.innerHTML = TABS.map(([id, label, svg]) => `<button class="tab ${id === tab ? "on" : ""}" role="tab" aria-selected="${id === tab}" data-tab="${id}"><svg viewBox="0 0 24 24">${svg}</svg>${label}</button>`).join("");
    tabsEl.onclick = (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; SOUND.fx("click"); if (typeof TABMENU !== "undefined" && TABMENU.fromBar) TABMENU.fromBar(); const to = typeof MENUS !== "undefined" ? MENUS.pick(b.dataset.tab) : b.dataset.tab; if (to === "pack" || to[0] === "@") return openMenu(to === "pack" ? "items" : to.slice(1)); closeMenu(); tab = to; bump(); renderTabs(); renderPanel(true); if (typeof POLISH !== "undefined") POLISH.swap($("#side")); if (typeof MOTION !== "undefined") MOTION.panel($("#side")); if (typeof MENUTOP !== "undefined") MENUTOP.top(); else $("#side").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); };   // menutop.js: the top of the screen (a smooth scroll stopped short while the panel slid in)
    $("#zoomBtn").onclick = () => { mapTouchedAt = performance.now(); kickMap(); zoom = zoom > 1.01 ? 1 : 2.4; follow = true; $("#zoomBtn").textContent = zoom > 1.01 ? "－" : "＋"; };
    if ($("#sneakBtn")) $("#sneakBtn").onclick = () => {
      if (!S) return; const onNow = SNEAKMODE.toggle(S); SOUND.fx("click"); persist(true);
      const b = $("#sneakBtn"); b.classList.toggle("on", onNow); b.setAttribute("aria-pressed", String(onNow));
      toast(onNow ? `You crouch and move quietly. Slower, fewer fights, and others must come within ${SNEAKMODE.myRange(S)} paces to spot you.` : "You stand up and walk normally.");
    };
    if ($("#huntBtn")) $("#huntBtn").onclick = () => {
      if (!S) return; const onNow = HUNT.toggle(S); SOUND.fx("click"); persist(true);
      const b = $("#huntBtn"); b.classList.toggle("on", onNow); b.setAttribute("aria-pressed", String(onNow));
      toast(onNow ? " You're hunting. You travel a little slower, but you'll run into deer, elk and worse far more often." : "You stop tracking game.");
    };
    if (typeof RIDING !== "undefined") RIDING.bind($("#rideBtn"), () => S, (m) => { liveCache.key = ""; if (S.trip) S.trip.total = G.minutesLeft(S); kickMap(); toast(m); renderTrip(); publishCard(); persist(true); });   // riding.js: get on / off from the map
    $("#centerBtn").onclick = () => { mapTouchedAt = performance.now(); kickMap(); follow = true; if (zoom === 1) zoom = 2.4; $("#zoomBtn").textContent = "－"; };
    bindMap();
    if (typeof WAGONS !== "undefined") WAGONS.mount({ S: () => S, Store, toast, persist: () => persist(), livePos: () => livePos(), kick: () => kickMap(), message: (t, x) => showMessage(t, x), canDecide: () => (typeof PARTYPLAY === "undefined" || PARTYPLAY.canDecide(S)), secsTo: (p) => G.minutesTo(S, p) * 60, zoom: () => zoom, zoomAt: (z, x, y) => { mapZoomAt?.(z, x, y); mapTouchedAt = performance.now(); kickMap(); }, go: (cid, intent) => chaseCaravan(cid, intent) });   // tap a caravan's wagons on the map: their card (wagons.js)
    if (typeof GREET !== "undefined") GREET.mount({ S: () => S, Store, toast, persist: () => persist(), others: () => others, party: () => party, otherPos: (o) => otherPos(o), livePos: () => livePos(), onAct: (e) => onPanelClick(e), acts: (o) => heroActs(o) });   // Strangers until you greet each other (greet.js); their map panel (mapsheet.js)
    if (typeof PCMAP !== "undefined") PCMAP.mount({ S: () => S, party: () => party, others: () => others, otherPos: (o) => otherPos(o), livePos: () => livePos(), tab: () => tab, skyPage: () => sky?.page,   // PC: the map is the home screen (pcmap.js)
      view: () => ({ zoom, center, transform: view.transform }), setView: (z, cn) => { zoom = z; center = cn; follow = false; mapTouchedAt = performance.now(); kickMap(); const zb = $("#zoomBtn"); if (zb) zb.textContent = zoom > 1.01 ? "－" : "＋"; },
      recentre: () => { follow = true; mapTouchedAt = performance.now(); kickMap(); }, kick: () => { mapResized = true; kickMap(); },
      go: (t) => window.__ui.go(t), openMenu: (p) => openMenu(p), closeMenu: () => closeMenu(), jump: (o) => window.__ui.jump(o), toast });
    if (typeof HUD !== "undefined") HUD.mount($("#mapwrap"), (name) => { if (WORLD.places[name]) { SOUND.fx("click"); selected = name; roamSpot = null; renderPicked(); } });
    $("#sndBtn").onclick = openSound;
    $("#socBtn").onclick = () => { SOUND.fx("click"); closeMenu(); tab = "social"; bump(); renderTabs(); renderPanel(true); if (typeof MENUTOP !== "undefined") MENUTOP.top(); else $("#side").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); };
    $("#side").addEventListener("click", onPanelClick);
    { let ls = $("#locs"); if (!ls) { ls = document.createElement("div"); ls.id = "locs"; ls.hidden = true; document.body.appendChild(ls); } ls.addEventListener("click", onPanelClick); ls.addEventListener("change", onPanelChange); }   // locscreen.js: the place full screen
    $("#side").addEventListener("change", onPanelChange);
    $("#side").addEventListener("input", onPanelInput);
    $("#side").addEventListener("keydown", (e) => { if (e.target.id === "chatin" && e.key === "Enter") { e.preventDefault(); chatSend(e.target.value); } if (e.target.id === "dmin" && e.key === "Enter") { e.preventDefault(); sendDM(); } });
    $("#trip").addEventListener("click", onPanelClick);
    $("#raid").addEventListener("click", onPanelClick);
    // [gatherarea] the Gathering card no longer floats over the map (#gpop): it is a section of the Area tab (gatherui.js)
    if (typeof GATHERUI !== "undefined") GATHERUI.bind((what, id) => gatherAct(what, id));   // a screen hosting GATHERUI.render() hands its taps here
    { let gn = $("#gnear"); if (!gn) { gn = document.createElement("div"); gn.id = "gnear"; document.body.appendChild(gn); gn.addEventListener("click", onPanelClick); } }   // "Snowberries in reach: Gather" over the map, on the road too
    Store.watch("raids", (docs) => { raidDocs = docs; });
    if (typeof LEVELUP !== "undefined") LEVELUP.mount({ S: () => S, persist, toast, refresh: () => { bump(); renderPanel(true); if ($("#sky")) renderMenu(); }, publishCard: () => publishCard() });   // levelup.js: skill/level notices, the three pillars
    if (typeof ONBOARD !== "undefined") ONBOARD.mount({ S: () => S, persist, toast, renderPanel, click: onPanelClick, party: () => party, invites: () => invites });   // first-time tips (onboard.js)
    if (typeof WORLDEV !== "undefined") WORLDEV.mount({ S: () => S, persist, toast, showFightResult, showMessage, openModal, closeModal, postNews, click: onPanelClick });   // world events (worldevents.js)
    if (typeof SIDEUI !== "undefined") SIDEUI.mount({ S: () => S, persist, toast, showMessage, openModal, closeModal, render: () => renderPanel(true), party: () => party, click: onPanelClick });   // pick a side: letters, recruiters, the Faction tab (sideui.js)
    if (typeof AFFL !== "undefined") AFFL.mount({ S: () => S, party: () => party, cardOf });   // afflictions: party mates (afflictions.js)
    if (typeof DWEMER !== "undefined") DWEMER.mount({ S: () => S, persist, toast, showMessage, renderPanel });   // the lexicon and valve puzzles (dwemer.js)
    if (typeof TREASURE !== "undefined") TREASURE.mount({ S: () => S, persist, toast, showMessage, renderPanel, openModal, closeModal, party: () => party, Store: typeof Store !== "undefined" ? Store : null, splitGold: (g, w) => (ppUI && ppUI.splitGold ? ppUI.splitGold(g, w) : null), enterDungeon: () => { selected = null; renderPicked(); dunNote = null; renderDungeon(); } });   // treasure maps and relics (treasure.js)
    if (typeof HEISTS !== "undefined") HEISTS.mount({ S: () => S, persist, toast, showMessage, renderPanel, openModal, closeModal, party: () => party, Store: typeof Store !== "undefined" ? Store : null, mates: () => (ppUI && ppUI.mates ? ppUI.mates() : []), splitGold: (g, w) => (ppUI && ppUI.splitGold ? ppUI.splitGold(g, w) : null) });   // heists in the big cities (heists.js)
    if (typeof LEGHUNT !== "undefined") LEGHUNT.mount({ S: () => S, persist, toast, showMessage, renderPanel });   // legendary monster contracts (leghunt.js)
    if (typeof BLACKREACH !== "undefined") BLACKREACH.mount({ S: () => S, persist, toast, showFightResult, showMessage, renderPanel, tb: tbCall });   // the cavern under Alftand (blackreach.js)
    if (typeof GREATEV !== "undefined") GREATEV.mount({ S: () => S, persist, toast, showFightResult, showMessage, openModal, closeModal, postNews, click: onPanelClick, party: () => party });   // great world events: banner + countdown (greatevents.js)
    if (typeof CRISES !== "undefined") CRISES.mount({ S: () => S, persist, toast, showFightResult, showMessage, openModal, closeModal, postNews, party: () => party });   // regional crises: hold status, contracts, bosses (crises.js)
    if (typeof EXPEDITION !== "undefined") EXPEDITION.mount({ S: () => S, persist, toast, render: () => { if (document.getElementById("lng-root")) renderPanel(true); }, party: () => party, cardOf,
      online: (id) => { const c = cardOf(id); return !!c && (typeof SOCIAL === "undefined" || SOCIAL.status(c).online); } });   // the Expedition Table: tonight's adventure (expedition.js)
    if (typeof LONGHOUSE !== "undefined") LONGHOUSE.mount({ S: () => S, persist, toast, showMessage, render: () => renderPanel(true), party: () => party });   // the adventuring company longhouse (longhouse.js)
    if (typeof COMMISSIONS !== "undefined") COMMISSIONS.mount({ S: () => S, persist, toast, render: () => { if (document.getElementById("lng-root")) renderPanel(true); }, party: () => party });   // the company's Commissions board (commissions.js)
    if (typeof HOLDUI !== "undefined") HOLDUI.mount({ S: () => S, persist, toast, showFightResult, postNews, refresh: () => { bump(); renderPanel(true); }, party: () => party });   // player-run holds: Jarl, tax, raids (holdui.js)
    if (typeof TOURNEYUI !== "undefined") TOURNEYUI.mount({ S: () => S, persist, toast, showFightResult, postNews, tbCall, refresh: () => { bump(); renderPanel(true); }, party: () => party, allies: () => allies() });   // festivals, contests and the Grand Arena (tourneyui.js)
    Store.watch("trades", (docs) => onTrades(docs));
    Store.watch("duels", (docs) => onDuels(docs));
    Store.watch("stalls", (docs) => onStalls(docs));
    if (typeof TB !== "undefined") {   // turn-based fights: toasts, and live turns for real players in your party
      TB.init({ toast: (t) => toast(t), remote: TB.remoteFor(Store, S.id) });   // only used while you're online with party members
      if (typeof SHAREDFIGHT !== "undefined") SHAREDFIGHT.mount({ store: Store, S: () => S, persist, toast: (t) => t && toast(t), after: () => renderPanel(true) });   // the leader's fight on your own full fight screen (sharedfight.js)
      TB.watchTurns(Store, () => S?.id);
    }
    Store.watch("halls", (docs) => onHalls(docs));
    Store.watch("pshare", (docs) => onShares(docs));
    if (typeof ECON !== "undefined") Store.watch("econ", (docs) => { ECON.set(docs); if (tab === "town") bump(); });
    Store.watch("verses", (docs) => { verseDocs = docs.filter((d) => d && d.uid && typeof d.text === "string"); onSong(); });
    Store.watch("verselikes", (docs) => { likeDocs = docs.filter((d) => d && d.verseId && d.voter); onSong(); });
    Store.watch("guards", (docs) => { guardDocs = docs; if (tab === "town" || (tab === "log" || tab === "social")) bump(); });
    Store.watch("friends", (docs) => onFriends(docs));
    Store.watch("dms", (docs) => onDMs(docs));
    if (Store.online) Store.put("friends", S.id, SOCIAL.record(S));
    Store.watch("clans", (docs) => { const before = myClanInvites().length; CLANS.set(docs, null); if (myClanInvites().length > before && !myClan() && typeof INVITES === "undefined") toast(`\uE13E You're invited to join a clan. Open \uE106 Social → Realm.`); bump(); renderTabs(); invRefresh(); });
    Store.watch("clanmem", (docs) => {
      CLANS.set(null, docs); bump();
      const c = myClan();   // the founder hears "Kacper declined your clan invite." and tidies the invite list
      if (c && c.founder === S.id && typeof INVITES !== "undefined") for (const n of INVITES.clanNotes(docs, c.id, seenNos, bootT - 60)) {
        if (n.fresh) toast("\uE13E " + n.text);
        const cur = CLANS.byId(c.id); if (cur && (cur.invites || []).includes(n.id)) Store.put("clans", S.id, (({ id, ...x }) => ({ ...x, invites: (x.invites || []).filter((i) => i !== n.id) }))(cur));
      }
    });
    Store.watch("chat", (docs) => onChat(docs));
    Store.watch("homes", (docs) => { homeDocs = docs; if (tab === "town") bump(); });
    if (typeof HSROOMS !== "undefined") HSROOMS.mount({ party: () => party, homes: () => homeDocs });   // party members visit their leader's homestead
    Store.watch("gifts", (docs) => onGifts(docs));
    Store.watch("war", (docs) => { WARS.setDocs(docs, S); holdChange(); if ((tab === "log" || tab === "social")) bump(); });
    Store.watch("bounty", (docs) => { BOUNTY.setDocs(docs, S); if ((tab === "log" || tab === "social") || tab === "town") bump(); });
    Store.watch("hall", (docs) => { HALL.setDonors(docs, S); if (tab === "town") bump(); });
    Store.watch("hallchest", (docs) => { HALL.setChest(docs); if (tab === "town") bump(); });
    Store.watch("ladder", (docs) => { ladderDocs = docs; if ((tab === "log" || tab === "social")) bump(); });
    Store.watchPlayers((ps) => { others = ps; if (typeof SIDES !== "undefined") SIDES.setCards(ps); if ((tab === "log" || tab === "social")) bump(); });
    Store.watchBags((b) => { bags = b; });
    Store.watch("attacks", (docs) => onAttacks(docs));
    Store.watch("parties", (docs) => {
      party = docs.find((p) => p.members?.some((m) => m.id === S.id)) || null;
      invites = docs.filter((p) => p.invites?.includes(S.id) && !p.members.some((m) => m.id === S.id));
      if (typeof INVITES !== "undefined") { for (const m of INVITES.notes(docs, S.id, seenNos, bootT - 60, "party")) toast("\uE106 " + m); invRefresh(); }   // "Kacper declined your party invite."
      if (party && party.leader === S.id && (party.invites || []).some((id) => party.members.some((m) => m.id === id)))   // a stale invite to someone already in the party: drop it
        Store.change("parties", party.id, (p) => ({ ...p, invites: (p.invites || []).filter((id) => !p.members.some((m) => m.id === id)) }));
      if (ppUI) ppUI.onParty();
      if (coopUI?.onParty) coopUI.onParty();   // party members are in the leader's co-op run by themselves (coop.js)
      if ((tab === "log" || tab === "social")) bump();
      if (tab === "map") renderPanel(false);
    });
    if (typeof COOP !== "undefined") {   // co-op dungeons (coop.js)
      coopUI = COOP.ui({ S: () => S, toast, esc, Store, others: () => others, party: () => party, cardOf, persist, publishCard, renderDungeon, renderPanel, bump,
        sendDm: (id, name, text) => { const r = SOCIAL.dm(S, id, name, text); if (!r.err && Store.online) Store.put("dms", r.id, r.doc); } });
      Store.watch("runs", (docs) => { coopUI.onRuns(docs); if (typeof INVITES !== "undefined") { for (const m of INVITES.notes(docs, S.id, seenNos, bootT - 60, "coop")) toast("\uE101 " + m); invRefresh(); } });
    }
    if (typeof INVITES !== "undefined") INVITES.mount({ list: inviteList, answer: answerInviteCard, toast, onNew: () => SOUND.fx("page"),   // Accept / Decline cards on top (invites.js)
      openSocial: () => { closeMenu(); tab = "social"; socTab = "party"; bump(); renderTabs(); renderPanel(true); } });
    if (typeof SAMEVER !== "undefined") SAMEVER.watch({ S: () => S, party: () => party, cardOf });   // party mates on a newer build: "Update to play together" (samever.js)
    if (typeof FRIENDJOIN !== "undefined") FRIENDJOIN.mount({ S: () => S, party: () => party, cardOf, Store, toast, invite: (c) => invite(c), invites: () => invites, acceptInvite: (pid) => acceptInvite(pid),   // friends: what they're doing + Ask to join (friendjoin.js)
      fighting: () => (typeof TB !== "undefined" && TB.open) || !!S?.encounter, trading: () => tab === "town" && !!townShop && townShop !== "inn", publishCard: (f) => publishCard(f), refreshInvites: invRefresh,
      bump: () => { if (tab === "social") bump(); }, render: () => { if (tab === "social") renderPanel(true); } });
    if (typeof PARTYPLAY !== "undefined") {   // party play: the leader leads, ready checks, shared spoils (partyplay.js)
      ppUI = PARTYPLAY.ui({ S: () => S, party: () => party, others: () => others, cardOf, otherPos: (c) => otherPos(c), livePos: () => livePos(), Store, toast, esc,
        persist, publishCard, renderPanel, bump, travelNow: (name, pos) => travelTo(name, true, pos), modalOpen: () => !!$("#modal"), openModal, closeModal,
        enterNow: () => { selected = null; renderPicked(); dunNote = null; renderDungeon(); } });
    }
    if (typeof LOOTVOTE !== "undefined" && coopUI) {   // party loot pile and end-of-run vote (lootvote.js)
      lvUI = LOOTVOTE.ui({ S: () => S, runs: () => coopUI.runs, Store, toast, esc, persist, openModal, closeModal, modalOpen: () => !!$("#modal"), renderDungeon,
        nameOf: (id) => cardOf(id)?.name || party?.members?.find((m) => m.id === id)?.name, dungeonAct: (c, replay) => dungeonAct(c, replay) });
      Store.watch("runs", () => { lvUI.onRuns(); if (S.dungeon && $("#dun")) renderDungeon(); });
      Store.watch("lvotes", (docs) => lvUI.onVotes(docs));
    }
    if (typeof PARTYVOTE !== "undefined" && coopUI) {   // dungeon choices are a party vote, faces by the picks (partyvote.js)
      pvUI = PARTYVOTE.ui({ S: () => S, runs: () => coopUI.runs, Store, toast, esc, cardOf, persist, renderDungeon,
        online: (id) => { const c = cardOf(id); return !!c && (typeof SOCIAL === "undefined" || SOCIAL.status(c).online); },
        choose: (kind, key) => (kind === "way" ? dungeonRoom(key) : dunChoice(key)),
        optHTML: (pv, key, mine) => (pv.kind === "way" && typeof DUNCHOICE !== "undefined" ? DUNCHOICE.voteHTML(S, key, mine) : "") });   // a way to vote on is the same card as solo (dunchoice.js)
      Store.watch("runs", () => pvUI.onRuns());
    }
    if (typeof DUNEVENTS !== "undefined") DUNEVENTS.mount({ mates: () => others });   // mystery rooms: the party's best hero at a skill rolls (dunevents.js)
    if (typeof DGAMES !== "undefined") DGAMES.mount({ S: () => S, party: () => party, Store });   // watch the party leader's dungeon mini-games live
    if (typeof LIVECURSOR !== "undefined") LIVECURSOR.mount({ Store, uid: () => S.id, name: () => S.name });   // the player's pointer while others watch (livecursor.js)
    if (typeof PTRAPS !== "undefined" && coopUI) PTRAPS.mount({ S: () => S, runs: () => coopUI.runs, Store, toast, persist, act: (c) => dungeonAct(c) });   // the whole party plays each trap (partytraps.js)
    if (typeof DUNDROP !== "undefined" && coopUI) DUNDROP.mount({ S: () => S, Store, toast, esc, cardOf, persist, renderPanel, closeDungeon: () => { dunNote = null; closeDungeon(); },   // someone dropped: the run ends for everyone (dundropout.js)
      online: (id) => { const c = cardOf(id); return !!c && (typeof SOCIAL === "undefined" || SOCIAL.status(c).online); }, coopJoin: (id) => coopUI.act({ dataset: { act: "coopjoin", id } }) });
    Store.watch("chests", (docs) => { const had = chests.length; chests = docs.filter((c) => c.members?.some((m) => m.id === S.id)); if (chests.length > had) toast("\uE112 A party chest is waiting. Open \uE106 Social → Party."); if (tab === "log") bump(); });
    Store.watch("news", (docs) => { news = docs.sort((a, b) => b.t - a.t); if (news.length > 40) news.slice(40).forEach((n) => Store.remove("news", n.id)); if ((tab === "log" || tab === "social")) bump(); });
    G.setAllyProvider(() => allies());
    let lastPeers = 0;
    Store.onStatus?.((st) => {
      if (st.peers > lastPeers) { publishCard(); toast(`${st.peers} other player${st.peers > 1 ? "s" : ""} online.`); }
      lastPeers = st.peers; bump(); if (["map", "log", "social"].includes(tab)) renderPanel(false);
    });
    if (TOWNS.guardCheck(S) && !TOWNS.wanted(S)) setTimeout(openGuard, 400);
    document.addEventListener("visibilitychange", () => { if (document.hidden) Store.save(S); else tick(); });
    tick();
    setInterval(tick, 1000);
    festAnnounce();
    requestAnimationFrame(frame);
    if (typeof TABMENU !== "undefined") TABMENU.mount();   // the Tab compass is the home screen
    if (typeof FAVWHEEL !== "undefined") FAVWHEEL.mount({ save: () => S, persist: () => persist(true), toast: (t) => toast(t), sound: (k) => SOUND.fx(k), refresh: () => { bump(); renderPanel(true); if ($("#sky")) renderMenu(); } });   // the favourites wheel
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
    openModal(`${PATCHNOTES.barHTML("sheet", 'data-act="close"')}${PATCHNOTES.html()}<button class="btn pri" data-act="close" style="width:100%;margin-top:12px">Done</button>`, "pnsheet");
  }
  /* road events and encounters (events.js + encounters.js): only while you're watching. About one every
     2 minutes of walking (≈ every half in-game hour), never two within 45 seconds. */
  let lastEventAt = Date.now();
  const EVENT_PER_SECOND = 1 / 110, EVENT_GAP_MS = 45000;
  function maybeRoadEvent() {
    if (document.hidden || $("#modal") || S.trip?.status !== "travel" || S.trip.carriage || S.trip.boat || Date.now() - lastEventAt < EVENT_GAP_MS) return;
    if (G.minutesLeft(S) < 0.5 || Math.random() > EVENT_PER_SECOND * (typeof LEGHUNT !== "undefined" ? LEGHUNT.eventBoost(S) : 1)) return;   // legendary hunts: signs turn up more often inside the area
    if (typeof PARTYPLAY !== "undefined" && !PARTYPLAY.canDecide(S)) return;   // following the party leader: road events happen to them
    lastEventAt = Date.now();
    [S.x, S.y] = livePos();
    if (G.startEvent(S)) { persist(); openEvent(); ppUI?.leaderHalt("event", "something by the road", S.trip?.event?.text || ""); }
  }
  /* caravans on the road (caravanroad.js): your road brings you alongside one, or you tap its wagon on the map */
  function meetCaravan(cid, auto) {
    if (typeof CVROAD === "undefined") return;
    if (typeof PARTYPLAY !== "undefined" && !PARTYPLAY.canDecide(S)) { if (!auto) toast("Only your party's leader can stop for a caravan."); return; }
    const ev = CVROAD.meet(S, cid, livePos());
    if (!ev || ev.err) { if (!auto) toast(ev?.err || "That caravan has moved on."); return; }
    lastEventAt = Date.now(); SOUND.fx?.("arrive");
    persist(); ppUI?.leaderHalt("event", ev.name, ev.text); openEvent();
    const intent = typeof WAGONS !== "undefined" ? WAGONS.takeIntent(S, cid) : null;   // what you picked on the wagon's card
    if (intent && G.eventChoices(S).some((x) => x[0] === intent)) eventAction(intent);
  }
  /* the wagon card's Catch up (wagons.js): travel to where you'll meet the caravan; beside it, stop and meet it now */
  function chaseCaravan(cid, intent) {
    const t = G.now(), c = CARAVANS.all(t).find((x) => x.id === cid);
    if (!c) return toast("That caravan has moved on.");
    if (S.dungeon) return toast("Finish what you're doing first.");
    if (S.trip && S.trip.status !== "travel") return toast("Deal with what's in front of you first.");
    if (S.trip?.caravan) return toast("You're already guarding a caravan.");
    if (typeof PARTYPLAY !== "undefined" && !PARTYPLAY.canDecide(S)) return toast("Only your party's leader can stop for a caravan.");
    const pos = livePos();
    if (S.trip) { [S.x, S.y] = pos; }
    const ic = WAGONS.intercept(c, t, pos, (p) => G.minutesTo(S, p) * 60);
    WAGONS.chase(S, cid, intent, ic.secs, t);
    if (ic.near) {
      if (S.trip?.status !== "travel" || S.trip.carriage || S.trip.boat) { roamSpot = CARAVANS.pos(c, t + 120); travelTo(CARAVANS.roamBlocked(S) ? c.to : "__spot", true); }
      if (S.trip?.status === "travel") return meetCaravan(cid);
      return;
    }
    if (ic.town) { if (S.location === ic.town) return toast(`${c.line.name} is here in ${ic.town}. Find them in the Area tab.`); return travelTo(ic.town); }
    if (CARAVANS.roamBlocked(S)) return travelTo(c.to);   // a cart keeps to the roads: follow their road
    roamSpot = ic.pos; travelTo("__spot");
    if (S.trip) toast(`You set off after ${c.line.name}. About ${fmtMin(ic.secs / 60)} to catch them.`);
  }
  function maybeCaravan() {
    if (typeof CVROAD === "undefined" || document.hidden || $("#modal") || S.trip?.status !== "travel" || Date.now() - lastEventAt < 8000) return;
    if (typeof PARTYPLAY !== "undefined" && !PARTYPLAY.canDecide(S)) return;
    const c = CVROAD.autoMeet(S, livePos()); if (c) meetCaravan(c.id, true);
  }
  function caravanEscortPay() {
    if (typeof CVROAD === "undefined" || S.trip || !S.caravanJob?.escort) return;
    const m = CVROAD.arrived(S); if (!m) return;
    persist(true); SOUND.fx("coin"); showMessage("Caravan", " " + m);
  }

  function tick() {
    if (!S) return;
    if (typeof TB !== "undefined" && TB.open) return;   // the world waits while you play out a turn-by-turn fight
    const t = G.now();
    { const cm = CARAVANS.tick(S, t); if (cm) { persist(true); toast(cm); if (S.caravanJob === null) Store.change("guards", `${lastJobId}-${S.id}`, (d) => (d && d.status === "signed" ? { ...d, status: "left" } : d)); bump(); } lastJobId = S.caravanJob?.id || lastJobId; }
    tickTimers(t); hallTick(t); discoveryToast(); if (lvUI && Math.floor(t) % 3 === 0) lvUI.tick(); if (pvUI) pvUI.tick(); if (Math.floor(t) % 5 === 0) courierCheck();
    if (S.remake) remakeCheck();   // [remake] once per old hero
    if (typeof LIVING !== "undefined") { const lm = LIVING.tick(S, t); if (lm) { toast(lm); bump(); } }   // deeds remembered, whispers come true, the party leader's world (livingworld.js)
    if (typeof IMM !== "undefined") { IMM.tick(S); if (S.lastSeen && t - S.lastSeen > 3600 && !S.trip?.status) IMM.loading("Welcome back to Skyrim"); S.lastSeen = t; }
    if (S.trip?.status === "travel") {
      const wasFollow = !!S.trip.follow && party?.leader !== S.id;   // following the party leader (arrivearea.js)
      const out = G.advance(S, t, reachableBags());
      if (out.taken.length || out.bag || out.died || out.encounter || out.arrived) {
        out.taken.forEach((id) => Store.takeBag(id));
        if (out.bag) Store.addBag(out.bag);
        persist(true);
        if (out.died) { SOUND.fx("death"); showMessage("You died", out.died, true); }
        else if (out.encounter) { openEncounter(); ppUI?.leaderHalt("encounter", out.encounter.name, out.encounter.text); }
        else if (out.arrived) {
          SOUND.fx("arrive"); tally("arrivals"); festCount("arrive"); if (typeof EXPEDITION !== "undefined") EXPEDITION.hook("arrive", { place: out.arrived });
          if (typeof IMM !== "undefined") IMM.bark(S, out.arrived);
          if (!WORLD.places[out.arrived]) {   // free roam or a pin: say what's around
            const near = ROAM.around(S), msg = `You stop in ${ROAM.isRoam(out.arrived) ? out.arrived : `the spot you marked (${out.arrived})`}. ${Terrain.NAMES[Terrain.typeAtPos([S.x, S.y])]} all around.${near.length ? ` Nearby: ${near.join(", ")}.` : " Nothing you know of nearby."}`;
            G.note(S, " " + msg); toast(msg);
          } else
          toast(`Arrived at ${out.arrived}.` + (G.shopTypes(out.arrived).length ? " Shops are in the Area tab." : DUNGEONS.enterable(out.arrived) ? " You can go inside." : ""));
          selected = null; renderPanel(true);
          caravanPay();
          const jm = TOWNS.checkJobs(S); if (jm.length) { tally("jobs", jm.length); persist(); setTimeout(() => toast(jm.join(" ")), 1500); }
          if (TOWNS.guardCheck(S)) openGuard();
          const qa = QUESTS.active(S).find((a) => a.st.obj.talk === out.arrived);
          if (qa) setTimeout(() => toast(` ${qa.st.title}: "${qa.st.obj.label}" is waiting in the Journal.`), 2500);
          if (out.solIntro) { persist(true); setTimeout(() => showMessage("Quest", out.solIntro), 700); }
          if (typeof ARRIVEAREA !== "undefined") ARRIVEAREA.arrive({ s: S, place: out.arrived, known: !!WORLD.places[out.arrived], follower: wasFollow, tab, menu: !!$("#sky"), go: goArea });   // the Area tab opens (once the screen is clear)
        }
      } else { Store.save(S); maybeRoadEvent(); maybeCaravan(); }
    }
    caravanEscortPay();
    followParty(); ppUI?.tick(); checkAmbush(); renderRaid(); soundTick();
    if (S.tut?.step > 0 && TUT[S.tut.step]?.done()) bump();
    if (Math.floor(t) % 5 === 0) { checkAch(); bloodTick(); }
    if (Math.floor(t) % 3 === 0) { const qm = QUESTS.check(S); if (qm.length) { persist(true); showMessage("Quest", qm.join(" ")); } }
    if (Math.floor(t) % 30 === 0) { publishCard(false); publishHome(); publishClan(); }
    if (Math.floor(t) % 60 === 0) BACKUP.autoSave(S);
    renderTop(); renderVitals(); renderTrip(); renderGatherNear(); renderTabs(); hudCompass();
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
    if (lastPending != null && S.pendingLevels > lastPending && !(typeof LEVELUP !== "undefined" && LEVELUP.live)) { SOUND.fx("levelup", 0.3); if (typeof POLISH !== "undefined") POLISH.levelUp(S.level); }   // levelup.js has its own LEVEL UP moment
    lastGold = S.gold; lastPending = S.pendingLevels;
    if (lastDragons != null && (S.dragons || 0) > lastDragons) tally("dragons", (S.dragons || 0) - lastDragons);
    lastDragons = S.dragons || 0;
  }
  function openSound() {
    openModal(`<h2>Settings</h2>${settingsHTML()}
      <button class="btn" data-act="guide" style="width:100%;margin-top:14px"> Guide for new players</button>
      ${typeof PATCHNOTES !== "undefined" ? `<button class="btn" data-act="notes" style="width:100%;margin-top:8px"> Patch notes</button>` : ""}
      <div class="grid2" style="margin-top:8px"><button class="btn" data-act="toupdate">${updNewer() ? " Update ready" : "Check for updates"}</button><button class="btn" data-act="totitle">Main menu</button></div>
      <button class="btn pri" data-act="close" style="width:100%;margin-top:10px">Done</button>`);
    const m = $("#modal");
    m.addEventListener("input", onSettingsInput); m.addEventListener("change", onSettingsInput);
  }
  function renderTop() {
    $("#nm").textContent = S.name;
    const where = S.location || (S.trip?.boat ? `at sea on ${S.trip.ship || "the ship"}` : `the wilds of ${G.holdAt(livePos())}`);
    $("#sub").textContent = typeof HUD !== "undefined" ? `${D.RACES[S.race].name} · ${where}` : `Level ${S.level} ${D.RACES[S.race].name} · ${where}`;
    const lb = $("#lvlb"); if (typeof MOTION !== "undefined") MOTION.count(lb, S.level, "", { pop: false }); else if (lb && lb.textContent !== String(S.level)) lb.textContent = S.level;
    if (typeof MOTION !== "undefined") { MOTION.xp($(".top"), S.charXp / F.charXpNeeded(S.level), S.level); MOTION.place(S.location, !!(S.location && WORLD.places[S.location] && ["city", "town"].includes(WORLD.places[S.location][2]))); }
    const wx = WEVENTS.weather(livePos()), dt = WEVENTS.date();
    const clk = $("#clock"), when = `${dt.day} ${dt.month}, ${G.clockText().split(", ")[1]}`;
    if (typeof SKY !== "undefined") {   // a small drawn sky: sun or moon phase, clouds, rain, snow
      const st = SKY.state(livePos()), ic = SKY.icon(st, 22);
      if (clk._ic !== ic) { clk._ic = ic; clk.innerHTML = `<span class="skyw">${ic}</span><span class="skyt"></span>`; }
      const cs = typeof WFX !== "undefined" ? WFX.coldState(S) : null, txt = `${when} · ${wx.name}${cs && cs.tier ? ` · ${cs.icon} ${cs.label}` : ""}`; const tEl = clk.querySelector(".skyt"); if (tEl && tEl.textContent !== txt) { tEl.textContent = txt; clk.title = txt; }
    } else clk.textContent = `${G.isNight() ? "" : ""} ${when} · ${wx.icon} ${wx.name}`;
    if (typeof MOTION !== "undefined") MOTION.count($("#goldv"), S.gold, " gold"); else $("#goldv").textContent = `${S.gold} gold`;
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
    const qp = questPos(), qa = qp ? QUESTS.tracked(S) : null;
    const raid = WEVENTS.activeRaid();
    HUD.compass({ pos, target, W, H, places: [...near.slice(0, 8), ...unk.slice(0, 3)],
      players: others.filter((o) => !o.hiding && sameMap(o) && seesHero(o)).map((o) => ({ name: typeof GREET !== "undefined" ? GREET.label(S, o, party) : o.name, pos: otherPos(o) })).filter((o) => G.pxDist(pos, o.pos) < 220).slice(0, 8),
      quest: qp ? { pos: qp, name: qa ? QUESTS.target(qa.st) : "" } : null,
      raid: raid && WORLD.places[raid.town] ? { town: raid.town, pos: WORLD.places[raid.town] } : null,
      dest: tr && tr.status === "travel" && tr.dest && !tr.boat ? { name: tr.destName, pos: tr.dest } : null });
    if (typeof HUD2 !== "undefined") { const tq = QUESTS.tracked(S); HUD2.objective(tq && tq.st ? { title: tq.st.title, where: QUESTS.target(tq.st) } : null); }   // hud2.js: the objective line under the compass
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
  /* a ripe patch within reach (also while walking or riding): a small Gather prompt over the map (harvestgame.js) */
  function renderGatherNear() {
    const el = $("#gnear"); if (!el) return;
    let html = "";
    if (typeof HARVESTGAME !== "undefined" && (tab === "map" || tab === "places") && !S.dungeon && !HARVESTGAME.isOpen()) { try { html = HARVESTGAME.nearHTML(S); } catch (e) { html = ""; } }
    // [nocover] PC: the Gathering card already shows this patch's Gather button, so the prompt would be the same action twice
    if (html && innerWidth >= 900) { const id = (html.match(/data-act="gpick" data-id="([^"]*)"/) || [])[1]; if ([...document.querySelectorAll("[data-act=gpick]")].some((b) => !b.closest("#gnear") && b.getClientRects().length && (!id || b.dataset.id === id))) html = ""; }
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  }
  function renderTrip() {
    const el = $("#trip"), tr = S.trip;
    if (typeof RIDING !== "undefined") RIDING.sync(S);   // cheap: only toggles classes on the map's ride button
    const put =(html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };   // only redraw on change, so taps don't get lost
    const fpt = typeof FPT !== "undefined" && $("#mapwrap");   // fptravel.js: on the road the trip is a first-person band at the top of the map
    if (fpt && !(tr && tr.status === "travel" && !S.dungeon)) FPT.hide();
    if (S.dungeon) { put(`<div class="trip enc"><div class="row"><b> You're inside ${esc(S.dungeon.place)}</b><button class="btn danger sm" data-act="dun">Go back in</button></div></div>`); return; }
    if (!tr) { put(""); return; }
    if (tr.status === "event") {
      put(`<div class="trip"><div class="row"><b> Something by the road</b><button class="btn pri sm" data-act="openev">Look</button></div></div>`);
      return;
    }
    if (tr.status === "hold") {   // following the party leader, who has stopped for something (partyplay.js)
      put(`<div class="trip enc"><div class="row"><b>⚑ ${esc(party?.leaderName || "Your leader")} stops: ${esc(party?.halt?.name || "something on the road")}</b></div><div class="sub">Their call. You fight beside them if it comes to blows.</div></div>`);
      return;
    }
    if (tr.status === "encounter") {
      put(`<div class="trip enc"><div class="row"><b>${tr.encounter.hunt ? ` ${tr.encounter.prey ? "Game spotted" : "Hunted"}: ${esc(tr.encounter.name)}` : ` ${esc(tr.encounter.name)} blocks the road`}</b><button class="btn danger sm" data-act="openenc">${tr.encounter.prey ? "Hunt it" : "Face it"}</button></div></div>`);
      return;
    }
    const mins = tripMinutesLeft(), total = Math.max(mins, tr.total || mins), p = pct(total - mins, total);
    const here = livePos(), ground = Terrain.NAMES[Terrain.typeAtPos(here)], sp = Terrain.speedAt(here);
    const pace = sp >= 1.2 ? "fast going" : sp >= 0.95 ? "steady" : sp >= 0.6 ? "slow going" : "very slow going";
    if (fpt) { put(""); FPT.show($("#mapwrap"), fptInfo(tr, here, ground, pace, mins), onPanelClick); return; }
    const html = `<div class="trip"><div class="row"><b>${esc(tr.origin)} → ${esc(tr.destName)}</b><span class="num sub">${fmtMin(mins)}</span>${!tr.carriage && !tr.boat && HORSES.present(S) && HORSES.downed(S) ? `<span class="chip hdownchip">\uE12D Downed</span>` : ""}${!tr.carriage && !tr.boat && HORSES.present(S) && !HORSES.downed(S) ? `<button class="btn sm" data-act="hride">${HORSES.riding(S) ? "Walk" : "Ride"}</button>` : ""}${tr.follow ? `<span class="chip ppfollow">⚑ following</span>` : `<button class="btn sm" data-act="stop">Stop</button>`}</div>
      <div class="bar"><i style="background:var(--frost)"></i></div>
      <div class="sub">${tr.boat ? `\uE12F aboard ${esc(tr.ship || "the ship")} · nothing attacks a ship at sea` : tr.carriage ? "\uE12D by carriage · safe on the Jarl's roads" : `${esc(ground)} · ${pace} · ${HORSES.riding(S) ? `riding ${esc(S.horse.name)}` : HORSES.present(S) && HORSES.downed(S) ? `on foot · ${esc(S.horse.name)} is downed and limps beside you` : HORSES.present(S) ? `walking beside ${esc(S.horse.name)}` : G.overweight(S) ? "too heavy to run" : "on foot"}`}${S.follower ? ` · ${esc(TOWNS.FOLLOWERS[S.follower.id][0])} with you` : ""}</div>
      ${tr.log.length ? `<div class="sub">${esc(tr.log[0])}</div>` : ""}</div>`;
    put(html.replace(/<\/div>$/, `<div class="tripvig"></div></div>`));
    const bar = el.querySelector(".bar i"); if (bar) bar.style.width = `${p}%`;
    if (tr.boat && typeof SOLART !== "undefined") { const tv = el.querySelector(".tripvig"); if (tv && !tv.dataset.sea) { tv.dataset.sea = 1; tv.innerHTML = SOLART.sea(); } }   // at sea (solart.js)
    else if (typeof FXART !== "undefined") FXART.vignette(el.querySelector(".tripvig"), { ground, progress: p / 100, dest: tr.destName, origin: tr.origin, riding: HORSES.riding(S), carriage: !!tr.carriage, boat: !!tr.boat, horse: HORSES.riding(S) ? HORSES.coat(S.horse.coat)[2] : null, led: typeof RIDING !== "undefined" ? RIDING.led(S) : null, look: myLook(), company: typeof PARTY !== "undefined" ? PARTY.companions(S, party, others, here, (o) => otherPos(o), MP.NEAR_PX) : [], reduce: reduceMotion, sky: typeof SKY !== "undefined" ? SKY.state(here) : null });
  }
  /* what the first-person travel band needs (fptravel.js): route, time, stops on the way, mount, company, sky, heading */
  let fptStops = { key: "", list: [] };
  function fptInfo(tr, here, ground, pace, mins) {
    const W = G.MAP_W, H = G.MAP_H, brg = (a, b) => (Math.atan2((b[0] - a[0]) * W, -(b[1] - a[1]) * H) * 180 / Math.PI + 360) % 360;
    const path = tr.path || [], idx = Math.max(0, Math.min(tr.idx || 0, path.length - 1));
    // distance along the route: the bar and the places you pass on it
    const segs = []; let tot = 0; for (let i = 1; i < path.length; i++) { const d = G.pxDist(path[i - 1], path[i]); segs.push(tot); tot += d; }
    let done = 0; if (path.length > 1) { done = (segs[Math.min(idx, segs.length - 1)] || 0) + G.pxDist(path[idx], here); }
    const f = tot > 0 ? Math.max(0, Math.min(1, done / tot)) : Math.max(0, Math.min(1, 1 - mins / Math.max(mins, tr.total || mins || 1)));
    const key = tr.destName + "|" + path.length + "|" + (tr.start || []).join(",");
    if (fptStops.key !== key) {
      const list = [];
      if (tot > 0) for (const [n, pp] of Object.entries(WORLD.places)) {
        if (n === tr.destName || n === tr.origin || !known(n)) continue;
        let best = 9, at = 0;
        for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], dx = (b[0] - a[0]) * W, dy = (b[1] - a[1]) * H, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((pp[0] - a[0]) * W * dx + (pp[1] - a[1]) * H * dy) / L2)), d = Math.hypot((a[0] + (b[0] - a[0]) * u - pp[0]) * W, (a[1] + (b[1] - a[1]) * u - pp[1]) * H); if (d < best) { best = d; at = segs[i - 1] + Math.sqrt(L2) * u; } }
        if (best < 8) list.push({ name: n, f: at / tot });
      }
      fptStops = { key, list: list.sort((a, b) => a.f - b.f).filter((s, i, a) => !i || s.f - a[i - 1].f > 0.03).slice(0, 8) };
    }
    // the bend ahead: where the road goes after the next waypoint, against where you're looking now
    const ahead = path.slice(idx + 1).filter((q) => G.pxDist(here, q) > 4), nx = ahead[0] || tr.dest, far = ahead.find((q) => G.pxDist(nx, q) > 25) || tr.dest;
    const heading = typeof HUD !== "undefined" ? HUD.heading : brg(here, nx);
    let turn = ((brg(nx, far) - brg(here, nx)) % 360 + 540) % 360 - 180; if (G.pxDist(here, tr.dest) < 12) turn = 0;
    const hp = HORSES.present(S), downed = hp && HORSES.downed(S), riding = HORSES.riding(S);
    let say = null;
    try { if (S.follower && typeof BONDS !== "undefined") { const e = BONDS.bond(S, S.follower.id)?.bond?.log?.[0]; if (e && G.now() - e.t < 20 && e.w) say = { who: e.w, line: e.dog ? e.l : `"${BONDS.T(e.l)}"` }; } } catch { /* no line */ }
    const wx = WEVENTS.weather(here);
    return { id: S.id || S.name, origin: tr.origin, dest: tr.destName, timeText: fmtMin(mins), p: tr.boat ? Math.max(0, Math.min(1, 1 - mins / Math.max(mins, tr.total || 1))) : f,
      stops: fptStops.list.map((s) => ({ ...s, passed: s.f <= f })), ground, pace: tr.boat || tr.carriage ? "" : pace, slow: pace === "very slow going",
      riding: riding && !tr.carriage && !tr.boat, canRide: !tr.carriage && !tr.boat && hp && !downed, horse: hp ? { name: S.horse.name, coat: HORSES.coat(S.horse.coat)[2] } : null, downed,
      heavy: G.overweight(S), carriage: !!tr.carriage, boat: !!tr.boat, ship: tr.ship, follow: !!tr.follow, weather: wx && wx.id !== "clear" ? wx.name : "",
      sky: typeof SKY !== "undefined" ? SKY.state(here) : null, heading, turn, destBear: tr.dest ? brg(here, tr.dest) : null, look: myLook(),
      company: typeof PARTY !== "undefined" ? PARTY.companions(S, party, others, here, (o) => otherPos(o), MP.NEAR_PX).map((c) => ({ name: c.name, player: !!c.player, riding: !!c.riding })) : [],
      pet: S.pet ? (S.pet.name || S.pet.id || "") : "", say, reduce: reduceMotion };
  }
  function renderTabs() {
    tabsEl.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.tab === (typeof MENUS !== "undefined" ? MENUS.activeGroup(tab, $("#sky") ? sky?.page : null) : tab);
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on);
      const needDot = (b.dataset.tab === "hero" && (S.pendingLevels > 0 || PERKS.pointsLeft(S) > 0)) || (b.dataset.tab === "log" && journalNew()) || (b.dataset.tab === "social" && socialBadge() > 0);
      if (needDot && !b.querySelector(".dot")) b.insertAdjacentHTML("beforeend", '<span class="dot"></span>');
      if (!needDot) b.querySelector(".dot")?.remove();
    });
    if (typeof MOTION !== "undefined") MOTION.tabs(tabsEl);
    if (typeof REMIND !== "undefined") REMIND.paint(S);   // number badges (remind.js)
    const sb = $("#socBtn"); if (sb) { const n = socialBadge(); sb.classList.toggle("on", tab === "social"); if (n && !sb.querySelector(".dot")) sb.insertAdjacentHTML("beforeend", '<span class="dot"></span>'); if (!n) sb.querySelector(".dot")?.remove(); }
  }

  // ------------------------------------------------------------ map
  let lastFrame = 0;
  /* battery: draw the map only while it's on screen, at 30 fps while something moves and 8 fps when all is still */
  let mapOnScreen = true, mapTouchedAt = 0, mapObserved = null, mapResized = false;
  /* [perf] between map pictures the loop sleeps on a timer instead of waking every screen refresh: an idle map used to
     wake the page 60 times a second just to decide not to draw, which kept the phone busy restyling everything else */
  let frameWait = 0;
  const nextFrame = (ms) => { if (ms > 20) frameWait = setTimeout(() => { frameWait = 0; requestAnimationFrame(frame); }, ms - 12); else requestAnimationFrame(frame); };
  function kickMap() { if (frameWait) { clearTimeout(frameWait); frameWait = 0; requestAnimationFrame(frame); } }   // a touch or resize: draw on the next refresh
  /* full-screen screens that hide the map completely (fight screen, menus, the compass home screen with its picture) */
  const mapCovered = () => !!(document.getElementById("tbf") || document.getElementById("sky") || document.querySelector("#tw > .tw-bg > *"));
  function frame(ts) {
    let wait = 16;
    try { wait = mapFrame(ts); } finally { nextFrame(wait); }
  }
  function mapFrame(ts) {   // draws the map if it's time; returns ms until it should look again
    const m = $("#map");
    if (m && mapObserved !== m && window.IntersectionObserver) { mapObserved = m; new IntersectionObserver((es) => { mapOnScreen = es[0].isIntersecting; if (mapOnScreen) kickMap(); }).observe(m);
      if (typeof FITCANVAS !== "undefined") FITCANVAS.watch(m, () => { mapResized = true; kickMap(); }); }   // phone turned / window resized: redraw at once (no stretched map)
    if (document.hidden || !m) return 250;
    if (!mapResized && (!mapOnScreen || mapCovered())) return 200;
    const moving = S?.trip?.status === "travel" || performance.now() - mapTouchedAt < 1500;
    const wx = WEVENTS.weather(livePos()).id, weatherAnim = !reduceMotion && !["clear", "cloudy", "fog"].includes(wx);
    const mapAnim = (typeof INKMAP !== "undefined" && INKMAP.pending()) || (typeof MAPTILES !== "undefined" && MAPTILES.pending()) || (typeof MAPART !== "undefined" && MAPART.active()) || (typeof MOTION !== "undefined" && MOTION.mapBusy()) || (typeof MAPHERO !== "undefined" && MAPHERO.active());   // a discovery burst or an arrival puff playing   // a discovery burst playing
    const raidNow = typeof RAIDART !== "undefined" && WEVENTS.activeRaid();
    const fxNow = typeof FXART !== "undefined" && S ? FXART.state(S) : null;   // spell and shout effects on the map
    const PC = typeof PCMAP !== "undefined" && PCMAP.on();   // PC map home screen (pcmap.js): smooth pan and zoom, living map (mapfx.js)
    const gap = PC && performance.now() - mapTouchedAt < 400 ? 16 : moving || mapAnim ? 33 : PC && typeof MAPFX !== "undefined" && MAPFX.busy(reduceMotion) ? 50 : weatherAnim || (raidNow && !reduceMotion) || (fxNow?.anim && !reduceMotion) ? 66 : 125;
    if (!mapResized && ts - lastFrame < gap - 4) return gap - (ts - lastFrame);
    lastFrame = ts; mapResized = false;
    const pos = livePos();
    if (follow) center = pos;
    const cones = visionCones(pos);
    view = {
      cones, foe: S.trip?.status === "encounter" && !S.trip.encounter?.prey ? S.trip.encounter?.name : null,
      region: WORLD.regionOf(pos),
      raid: raidNow ? raidView(raidNow) : null, fx: fxNow,
      player: pos, me: S.id, party: party ? { leader: party.leader, ids: party.members.map((m) => m.id) } : null, name: S.name, look: myLook(), side: typeof SIDES !== "undefined" ? SIDES.mine(S) : null, moving: S.trip?.status === "travel", pace: S.trip?.status === "travel" ? (G.speed(S) / G.BASE_WALK) * Terrain.speedAt(pos) : 0, trail: S.trip?.trail, dest: S.trip ? { pos: S.trip.dest, name: S.trip.destName, roam: !!S.trip.roam } : null, spot: selected === "__spot" ? roamSpot : null,
      route: S.trip && !S.trip.boat ? (S.trip.status === "travel" ? S.trip.path.slice(S.trip.idx + 1) : [S.trip.dest]) : null,
      sight: typeof SNEAKMODE !== "undefined" && !S.location && !S.dungeon ? SNEAKMODE.SIGHT_PX : 0, sneakRing: typeof SNEAKMODE !== "undefined" && S.sneak ? SNEAKMODE.myRange(S) : 0,
      discovered: S.discovered, explored: [...S.explored, pos], atPlace: !!S.location, others: others.filter((o) => sameMap(o) && seesHero(o)).map((o) => ({ name: typeof GREET !== "undefined" ? GREET.label(S, o, party) : (o.clan ? `[${o.clan}] ` : "") + o.name + (party?.members.some((m) => m.id === o.id) ? " ⚑" : ""), stranger: typeof GREET !== "undefined" && !GREET.knows(S, o.id, party), atPlace: !!o.loc, pos: otherPos(o), trail: party?.members.some((m) => m.id === o.id) ? otherTrail(o) : null, look: o.look, race: o.race, id: o.id, moving: !!o.moving, pace: o.moving ? (typeof o.ride === "string" ? 1.8 : 1) * Terrain.speedAt(otherPos(o)) : 0, horse: typeof o.ride === "string" ? o.ride : null, side: typeof SIDES !== "undefined" ? SIDES.of(o.id) : null, party: !!party?.members.some((m) => m.id === o.id) })),
      rulers: Object.entries(WARS.rulers(S)).map(([hold, c]) => ({ hold, color: c.colors[0] })),
      banners: CLANS.banners(homeDocs, S, VISITS.record(S)).filter((b) => WORLD.places[b.town]).map((b) => ({ ...b, pos: WORLD.places[b.town].slice(0, 2) })),
      cleared: clearedLeft(), bags: visibleBags(), selected: selected && WORLD.places[selected] ? selected : null, t: ts / 1000, zoom, center, reduceMotion, weather: WEVENTS.weather(pos).id, quest: questPos(), mask: typeof PRIESTS !== "undefined" ? PRIESTS.marker(S)?.pos : null, tmaps: typeof EXPLORE !== "undefined" ? EXPLORE.marks(S) : [], rumours: typeof RUMOURS !== "undefined" ? RUMOURS.marks(S) : [], herbs: typeof GATHER !== "undefined" ? GATHER.marks(S) : [], herbRange: typeof HARVEST !== "undefined" && !S.dungeon && HARVEST.nearPrompt(S) ? { pos: [S.x, S.y], r: GATHER.REACH_PX / 1000 } : null, pins: (S.pins || []).map((p) => ({ pos: [p.x, p.y], label: `${p.icon} ${p.label}`, on: selected === "__pin:" + p.id })),
      routes: party ? others.filter((o) => o.moving && o.path?.length > 1 && party.members.some((m) => m.id === o.id)).map((o) => ({ path: o.path, from: otherPos(o), name: o.name })) : [], horse: HORSES.riding(S) ? HORSES.coat(S.horse.coat)[2] : null, led: typeof RIDING !== "undefined" ? RIDING.led(S) : null, gallop: HORSES.riding(S) && S.trip?.status === "travel" && Terrain.speedAt(pos) >= 1.2, cart: CARAVANS.hasCart(S), guards: typeof GUARDS !== "undefined" ? GUARDS.visible(S).map((p) => (p.visible || !myCone || !VISION.inCone(myCone, p.pos) ? p : { ...p, visible: true })) : null, caravans: CARAVANS.all().map((c) => { const cp = CARAVANS.pos(c); return { cp, c }; }).map(({ cp, c }) => ({ pos: cp, visible: G.pxDist(cp, pos) < 160 || (myCone && VISION.inCone(myCone, cp)) || S.discovered.some((n) => WORLD.places[n] && ["city", "town"].includes(WORLD.places[n][2]) && G.pxDist(cp, WORLD.places[n]) < 45), khajiit: c.line.khajiit, moving: c.phase === "road", mine: S.caravanJob?.id === c.id, id: c.id, near: typeof CVROAD !== "undefined" && c.phase === "road" && CVROAD.canMeet(S) && G.pxDist(cp, pos) <= CVROAD.TAP_RANGE, label: c.line.name.replace(/'s caravan$/, "") })).filter((c) => !(c.mine && S.trip?.caravan)), hall: S.discovered.includes(HALL.TOWN) || known(HALL.TOWN) ? { pos: HALL.POS, label: `Hall of the North · ${HALL.progress().name}` } : null,
    };
    if (typeof WAGONS !== "undefined") WAGONS.decorate(view, S);   // hovered wagons, wagons in trouble
    WorldMap.draw($("#map"), view);
    return gap;
  }
  /* cones of sight (vision.js): yours, then each party member's (fainter); none inside a dungeon */
  function visionCones(pos) {
    myCone = null;
    if (typeof VISION === "undefined" || S.dungeon) return [];
    const tr = S.trip, hint = tr?.status === "travel" && tr.path ? tr.path[Math.min(tr.path.length - 1, (tr.idx || 0) + 1)] : null;
    myCone = VISION.cone(pos, VISION.track("me", pos, hint, tr?.status === "travel") ?? S.facing ?? null, VISION.forPos(S, pos));
    const out = myCone ? [{ c: myCone }] : [];
    if (party) for (const o of others) {
      if (!sameMap(o) || !party.members.some((m) => m.id === o.id)) continue;
      const op = otherPos(o), oa = VISION.track(o.id, op, o.moving && o.path?.length ? o.path[o.path.length - 1] : null, !!o.moving) ?? o.facing ?? null;
      const oc = VISION.cone(op, oa, VISION.forPos(null, op)); if (oc) out.push({ c: oc, faint: true });
    }
    return out;
  }
  let lookCache = { k: "", v: null };
  function myLook() {
    const k = JSON.stringify([S.race, S.loadout, G.loadout(S).equipment, S.vampire, S.werewolf, S.app || 0, S.sex || ""]);
    if (k !== lookCache.k) lookCache = { k, v: HEROART.lookOf(S) };
    return lookCache.v;
  }
  let mapZoomAt = null;   // bindMap's zoom-around-a-point, for wagons.js (a tapped cluster pin zooms in)
  function bindMap() {
    const c = $("#map"), pts = new Map();
    let down = null, moved = false, pinch = null;
    const setZoom = (z, fx, fy) => {     // zoom keeping the point under the fingers still
      const PC = typeof PCMAP !== "undefined" && PCMAP.on();   // on a PC you can zoom out to all of Skyrim (pcmap.js)
      z = Math.max(PC ? PCMAP.minZoomFor(c) : 1, Math.min(PC ? (PCMAP.maxZoomFor ? PCMAP.maxZoomFor(c) : PCMAP.MAXZ) : 6, z));
      if (view.transform && fx != null) {
        const { k, ox, oy } = view.transform, mx = (fx - ox) / k / WorldMap.W, my = (fy - oy) / k / WorldMap.H;
        const r = c.getBoundingClientRect(), nk = k * z / zoom;
        center = [mx - (fx - r.width / 2) / nk / WorldMap.W, my - (fy - r.height / 2) / nk / WorldMap.H];
        follow = false;
      }
      zoom = z; $("#zoomBtn").textContent = zoom > 1.01 ? "－" : "＋";
    };
    mapZoomAt = setZoom;
    let press = null, pressed = false;
    c.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]); c.setPointerCapture(e.pointerId); mapTouchedAt = performance.now(); kickMap();
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
      if (e.pointerType === "mouse" && !pts.size && view.transform && typeof WAGONS !== "undefined") { const r = c.getBoundingClientRect(); WAGONS.hover(view, e.clientX - r.left, e.clientY - r.top, c); }   // PC: wagons light up under the mouse
      if (!pts.has(e.pointerId)) return;
      mapTouchedAt = performance.now(); kickMap();
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
      if (moved && (zoom > 1 || (typeof PCMAP !== "undefined" && PCMAP.on())) && view.transform) { follow = false; center = [down.c[0] - dx / (WorldMap.W * view.transform.k), down.c[1] - dy / (WorldMap.H * view.transform.k)];
        if (typeof PCMAP !== "undefined" && PCMAP.on()) center = PCMAP.clampCenter(center, zoom, c.clientWidth, c.clientHeight, center[1] >= 1.5 ? WORLD.SOL_OY : 0); }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [p] = [...pts.values()]; down = { x: p[0], y: p[1], c: [...center] }; return; }
      if (!down) return;
      const wasMove = moved; down = null; clearTimeout(press);
      if (wasMove || pressed || !view.transform || e.type === "pointercancel") return;
      const r = c.getBoundingClientRect();
      if (typeof GREET !== "undefined" && GREET.tap(view, e.clientX - r.left, e.clientY - r.top)) return;   // another hero: their panel, Greet (greet.js)
      const cvTap = typeof CVROAD !== "undefined" && S.trip?.status === "travel" ? CVROAD.hit(view.caravans, screenToWorld(e.clientX - r.left, e.clientY - r.top), WorldMap.W, WorldMap.H, 24 / view.transform.k) : null;
      if (cvTap) { if (typeof MAPSHEET !== "undefined") MAPSHEET.close(); return meetCaravan(cvTap.id); }   // tapped a caravan's wagons while travelling: stop and meet them
      if (typeof WAGONS !== "undefined" && WAGONS.tap(view, e.clientX - r.left, e.clientY - r.top, c)) return;   // any other wagon: its panel; a cluster pin: zoom in (wagons.js)
      const pin = pinAt(e.clientX - r.left, e.clientY - r.top);
      selected = pin ? "__pin:" + pin.id : WorldMap.placeAt(view, e.clientX - r.left, e.clientY - r.top, known);
      if (!selected && typeof MAPSHEET !== "undefined" && MAPSHEET.isOpen()) { MAPSHEET.close(); selected = null; return; }   // [map-panels] the empty map closes an open panel first
      if (!selected) { const w = screenToWorld(e.clientX - r.left, e.clientY - r.top); if (WORLD.onMap(w)) { roamSpot = w; selected = "__spot"; } }
      if (selected && selected === S.location && typeof PCMAP !== "undefined" && PCMAP.on()) { selected = null; renderPicked(); tab = "town"; bump(); renderTabs(); renderPanel(true); PCMAP.refresh(); return; }   // PC: the town you're in opens its places beside the map
      renderPicked();
    };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("dblclick", (e) => {   // PC: double-click a place to set off at once
      if (typeof PCMAP === "undefined" || !PCMAP.on() || !view.transform) return;
      const r = c.getBoundingClientRect(), n = WorldMap.placeAt(view, e.clientX - r.left, e.clientY - r.top, known);
      if (n && n !== S.location && !S.trip && !S.dungeon) travelTo(n);
    });
    c.addEventListener("wheel", (e) => { if (typeof PCMAP !== "undefined" && PCMAP.wheel(e, c)) return; e.preventDefault(); mapTouchedAt = performance.now(); kickMap(); const r = c.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }
  let roamSpot = null;
  /* [map-panels] a tapped place, pin or spot opens in the map panel (mapsheet.js + placepanel.js) */
  function renderPicked() {
    if (!selected) { if (typeof MAPSHEET !== "undefined") MAPSHEET.close("place"); return; }
    const sp = typeof PLACEPANEL !== "undefined" && PLACEPANEL.spec(S, selected, { fmtMin, KIND, party, roamSpot });
    if (!sp) { selected = null; return renderPicked(); }
    MAPSHEET.open({ ...sp, onClick: (e) => onPanelClick(e), onClose: (why) => { if (why === "swap" && MAPSHEET.isOpen("place")) return; selected = null; roamSpot = null; kickMap(); } });
  }

  // ------------------------------------------------------------ travel
  function travelTo(name, force = false, posIn = null) {
    let pos;
    if (posIn) { pos = posIn; }
    else {
    if (name === "__bag") { const b = myBag(); if (!b) return toast("Your bag is gone."); pos = [b.x, b.y]; name = "your lost bag"; }
    else if (name === "__spot") { const cb = CARAVANS.roamBlocked(S); if (cb) return toast(cb); const r = roamSpot && ROAM.plan(S, roamSpot); if (!r || r.err) return toast(r?.err || "Pick a spot first."); pos = r.pos; name = r.name; }
    else if (name.startsWith("__pin:")) { const p = (S.pins || []).find((q) => "__pin:" + q.id === name); if (!p) return toast("That pin is gone."); pos = [p.x, p.y]; name = p.label; }
    else pos = WORLD.places[name].slice(0, 2);
    }
    if (S.location === name) return toast(`You're already in ${name}.`);
    if (ppUI && !force) {   // in a party: members follow the leader; the leader asks "ready?" first
      const m = ppUI.beforeTravel(name, pos);
      if (m === "check") { selected = null; renderPicked(); renderPanel(true); return; }
      if (m) return toast(m);
    }
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
    if (typeof NOTICES !== "undefined") NOTICES.opening();   // [notices] a waiting message pushed off the screen goes back in line
    closeModal();
    const m = document.createElement("div");
    m.className = "modal"; m.id = "modal";
    m.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    m.addEventListener("click", onPanelClick);
    document.body.appendChild(m);
    if (typeof MENUTOP !== "undefined") MENUTOP.focusFirst(m); else m.querySelector("button")?.focus();   // a window opens at its top
  }
  const closeModal = () => $("#modal")?.remove();
  /* [lightmenus] the gold knotwork frame is kept for prestige moments only (a quest done, a company founded, a crisis won);
     every other window gets the plain SkyUI hairline */
  /* [notices] one window at a time: a message that arrives on its own waits for the open window, fight or menu; the same one twice shows once */
  function showMessage(title, text, bad, prestige) {
    if (typeof POLISH !== "undefined") POLISH.fromText(text);
    const got = typeof RTIP !== "undefined" && !bad ? RTIP.take() : [];   // [rewardtips] a quest or crisis reward: its icons, with tooltips (taken now, so a waiting window keeps its own)
    if (typeof NOTICES !== "undefined") return NOTICES.modal(`${title}|${text}`, () => showMessageNow(title, text, bad, prestige, got));
    showMessageNow(title, text, bad, prestige, got);
  }
  function showMessageNow(title, text, bad, prestige, got) {
    if (/quest/i.test(title) || //.test(text)) SOUND.fx("quest");
    openModal(`${/^You died/.test(title) ? UIART.death(320, 120) : typeof EVENTART !== "undefined" ? EVENTART.story(title, text) : ""}<h2>${esc(title)}</h2><p>${esc(text)}</p>${got.length ? RTIP.strip(0, got) : ""}<button class="btn ${bad ? "danger" : "pri"}" data-act="close" style="width:100%">Continue</button>`, bad ? "enc" : (prestige || title === "Quest") ? "prestige" : "");
  }
  function fightLog(f) {
    return `${typeof FIGHTART !== "undefined" ? FIGHTART.placeholder(f, S) : ""}<details ${f.log.length < 9 ? "open" : ""}><summary class="sub" style="cursor:pointer;min-height:36px">Fight log (${f.turn} turns)${f.wx && f.wx.lines.length ? ` · ${f.wx.icon} ${esc(f.wx.name)}` : ""} — ${f.ai ? (f.hybrid ? "[n] = your rule fired · [AI] = Smart AI" : "[AI] = Smart AI's move") : "[n] is the tactic rule that fired"}</summary><div class="flog">${f.fpLine ? `<div class="fpline"><span class="r"></span><span>${esc(f.e.name)} · ${esc(f.fpLine)}</span></div>` : ""}${f.log.map((l) =>
      `<div><span class="r">${l.turn ? `T${l.turn}` : ""}${l.ai ? "<br>[AI]" : l.rule != null ? `<br>[${l.rule || "–"}]` : ""}</span><span>${esc(l.me)}${l.me && l.them ? " · " : ""}${esc(l.them)}${l.hp != null ? ` <span class="sub">(you ${l.hp} · foe ${l.ehp})</span>` : ""}${l.why ? `<em class="aiwhy"> ${esc(l.why)}</em>` : ""}</span></div>`).join("")}</div></details>`;
  }
  function openEncounter(note) {
    const e = S.trip?.encounter;
    if (e && e.hp <= 0) { S.trip.status = "travel"; S.trip.encounter = null; S.trip.lastTick = G.now(); persist(); renderTrip(); renderPanel(true); return toast(`The ${e.name} is already dead. Back on the road.`); }
    if (!e) return;
    openModal(`<p class="sub danger-${e.danger}" style="margin:0">${e.danger === "high" ? "Deadly" : e.danger === "medium" ? "Dangerous" : "Minor"} encounter · ${esc(e.hold)}${G.isNight() ? " · night" : ""}</p>
      <h2 style="margin:4px 0 8px">${esc(e.name)}</h2>${typeof FOEPERKS !== "undefined" ? FOEPERKS.html(e, esc) : ""}<p>${esc(e.text)}</p>
      ${note ? `<p class="sub">${esc(note)}</p>` : ""}${(() => { const am = typeof AMMO !== "undefined" ? AMMO.status(S) : null; return am && !am.best ? ammoNote() : ""; })()}${typeof MOUNTCOMBAT !== "undefined" ? MOUNTCOMBAT.note(S) : ""}${typeof WFX !== "undefined" ? WFX.noteHTML(S) : ""}
      <div class="grid2" style="margin:10px 0"><div class="vital"><small><span>You</span><span class="num">${Math.round(G.curHealth(S))}/${G.maxHealth(S)}</span></small><div class="bar"><i style="width:${pct(G.curHealth(S), G.maxHealth(S))}%;background:var(--hp)"></i></div></div>
      <div class="vital"><small><span>${esc(e.name)}</span><span class="num">${e.hp}/${e.health}</span></small><div class="bar"><i style="width:${pct(e.hp, e.health)}%;background:var(--ember)"></i></div></div></div>
      <div class="grid2">
        <button class="btn danger" data-act="enc" data-a="fight">\uE101 Fight</button>
        <button class="btn" data-act="enc" data-a="flee">\uE142 Flee</button>
        <button class="btn" data-act="enc" data-a="sneak">\uE10D Sneak past${typeof SNEAK2 !== "undefined" ? ` (${Math.round(SNEAK2.chance(S, e) * 100)}%)` : ""}</button>
        <button class="btn" data-act="enc" data-a="potion" ${G.countRestore(S, "health") ? "" : "disabled"}>\uE15B Potion (${G.countRestore(S, "health")})</button>
        ${typeof HUNTGAME !== "undefined" && HUNTGAME.fromEncounter(e) && ppUI?.canDecide?.() !== false ? (() => { const no = HUNTGAME.block(S, true); return `<button class="btn pri" data-act="huntroad" style="grid-column:1/-1" ${no ? "disabled" : ""}>\uE10C Stalk and shoot${no ? ` · ${esc(no)}` : ""}</button>`; })() : ""}
        ${e.bountyHold ? `<button class="btn pri" data-act="enc" data-a="pay" style="grid-column:1/-1">\uE121 Pay your ${esc(e.bountyHold)} bounty (${TOWNS.bounty(S, e.bountyHold)} gold)</button>` : ""}
      </div><p class="sub" style="margin-bottom:0">You play the fight turn by turn.${typeof SNEAK2 !== "undefined" ? "" : " A hidden start gives a sneak attack."}</p>${typeof SNEAK2 !== "undefined" ? SNEAK2.noteHTML(S, e, typeof AISET !== "undefined" ? AISET.get(G.loadout(S)).sneak : "safe", esc) : ""}`, "enc");
    ppUI?.onModal();   // a party is with you: they see this too and vote (partyplay.js)
  }
  /* the lines under a result: skill-ups and level-ups play as toasts (skillup.js); what's left (a follower's words) gets its own line */
  const skillsHTML = (list) => {
    if (typeof SKILLUP === "undefined") return (list || []).length ? `<p class="sub">\uE136 ${list.map(esc).join(" · ")}</p>` : "";
    return SKILLUP.others(list).map((l) => `<p class="sub${/^\uE139/.test(l) ? " su-say" : ""}">${esc(l)}</p>`).join("");
  };
  const skillLine = (r) => skillsHTML(r.skills);
  function openEvent(note) {
    const ev = S.trip?.event;
    if (!ev) return;
    const cvp = typeof WAGONS !== "undefined" && ev.cid && /^cvmeet_/.test(ev.id || "");   // a caravan's packs: crisis prices (wagons.js)
    const shop = ev.shop ? `<div class="list" style="margin:8px 0">${ev.shop.map((i) => { const p = cvp ? WAGONS.price(S, ev, i) : G.buyPrice(S, i, null); return `<div class="item${tiCls(i)}"><div class="t">${esc(D.ITEMS[i].name)}<span>${esc(G.itemStats(i))} · ${D.ITEMS[i].weight} wt</span></div><span class="num gold">${p}</span><button class="btn sm" data-act="evbuy" data-item="${i}" ${S.gold >= p ? "" : "disabled"}>Buy</button>${tiBox(i)}</div>`; }).join("")}</div><p class="sub">You have ${S.gold} gold.</p>` : "";
    const choices = ev.shop ? [["leave", "Say goodbye and move on"]] : G.eventChoices(S);
    openModal(`${typeof EVENTART !== "undefined" ? EVENTART.road(ev) : ""}<p class="sub" style="margin:0">On the road · ${esc(G.holdAt([S.x, S.y]))} · ${esc(Terrain.NAMES[Terrain.typeAtPos([S.x, S.y])])}</p>
      <h2 style="margin:4px 0 8px">${esc(ev.title || "Something by the road")}</h2><p>${esc(ev.text)}</p>
      ${note ? `<p class="sub">${esc(note)}</p>` : ""}${shop}
      <div class="evc${ev.enc ? " encc" : ""}">${choices.map(([c, label]) => `<button class="btn ${c === "leave" ? "" : /^(fight|free|hunt|help)$/.test(c) && //.test(label) ? "danger" : "pri"}" data-act="ev" data-c="${c}">${esc(label)}</button>`).join("")}</div>`);
    ppUI?.onModal();
  }
  function eventAction(c) {
    ppUI?.leaderPicked(c);   // in a party: everyone hears what the leader chose
    const evBefore = S.trip?.event, gold0 = S.gold, lvBefore = lvUI && ppUI ? LOOTVOTE.snap(S) : null;
    tbCall(() => (typeof ENC !== "undefined" ? ENC.decide(S, c) : G.eventChoice(S, c)), (r) => eventDone(c, r, evBefore, gold0, lvBefore));
  }
  function eventDone(c, r, evBefore, gold0, lvBefore) {
    if (r.blocked) return toast(r.text);
    if (lvBefore && !r.died) { const rv = LOOTVOTE.roadVote(S, lvBefore, ppUI.mates(), evBefore?.name); if (rv) { Store.put("lvotes", rv.id, rv.doc); r.text = `${r.text || ""} ${rv.text}`.trim(); } }   // the party votes on the leader's road finds
    if (ppUI && S.gold > gold0) { const sp = ppUI.splitGold(S.gold - gold0, "the road"); if (sp) r.text = `${r.text || ""} ${sp}`.trim(); }
    if (ppUI && S.trip?.status !== "event") ppUI.leaderResolved(r.text || (c === "leave" ? "moves on" : ""));
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (r.fight || r.died) return showFightResult(r);
    if (S.trip?.status === "event") return openEvent([r.text, ...(r.skills || [])].filter(Boolean).join(" "));
    if (c === "leave") return closeModal();
    openModal(`${typeof EVENTART !== "undefined" && evBefore ? EVENTART.road(evBefore) : ""}<h2>${esc(evBefore?.title || "On the road")}</h2><p>${esc(r.text)}</p>${skillLine(r)}
      <button class="btn pri" data-act="close" style="width:100%">Continue to ${esc(S.trip?.destName || "the road")}</button>`);
  }
  function encounterAction(a) { ppUI?.leaderPicked(a); tbCall(() => G.encounterAction(S, a), (r) => encounterDone(a, r)); }
  function encounterDone(a, r) {
    if (ppUI && S.trip?.status !== "encounter") ppUI.leaderResolved(r.died ? "fell on the road" : r.fight ? (r.fight.won ? `won the fight with ${r.fight.e?.name || "the foe"}` : "lost the fight") : (r.text || "").slice(0, 120));
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (a === "potion" && S.trip?.status === "encounter") return openEncounter(r.text);
    showFightResult(r);
  }
  /* a fight you won with party members beside you: leave a share for each of them */
  function shareSpoils(r) {
    if (typeof PARTY === "undefined" || !r?.fight || r.died || r.fight.nonlethal || S.dungeon?.run) return;
    const lf = PARTY.fought(); PARTY.clear();
    if (!lf.ids.length || G.now() - lf.t > 900) return;
    const { id, doc } = PARTY.shareDoc(S, r.fight, lf.ids, lf.names);
    Store.put("pshare", id, doc);
  }
  let sharesBusy = false;
  async function onShares(docs) {
    if (sharesBusy || !S || typeof PARTY === "undefined") return;
    const mine = PARTY.mineToTake(docs, S.id, S);
    if (!mine.length) return;
    sharesBusy = true;
    try {
      for (const d of mine) {
        let got = null;
        await Store.change("pshare", d.id, (x) => { const o = PARTY.claim(x, d.id, S.id); got = o.got; return o.doc; });
        const res = PARTY.give(S, d.id, d, got);
        if (res) { persist(true); toast(res.text); }
      }
    } finally { sharesBusy = false; }
    renderPanel?.(true);
  }
  /* turn-based fights (tbfight.js): an action that starts a fight pauses while you play it out */
  function tbCall(fn, done) { if (typeof TB === "undefined") return done(fn()); closeModal(); TB.call(S, fn, done); }
  /* the loot from a fight, as a SkyUI-style list: icon, name, weight, value */
  function lootList(r) {
    const idOf = (n) => (typeof FASTQOL !== "undefined" && FASTQOL.itemsNamed ? FASTQOL.itemsNamed(n)[0] : null);
    const rows = (r.loot || []).map((line) => {
      const m = String(line).match(/^(.*?)(?: ×(\d+))?$/), id = (typeof RTIP !== "undefined" && RTIP.idOf(m[1], S)) || idOf(m[1]), it = id && D.ITEMS[id], q = +(m[2] || 1);
      return `<div class="loot-row"${it ? (typeof RTIP !== "undefined" ? RTIP.attr(id, q) : ` data-tip-k="item:${esc(id)}"`) : ""}>${it ? (typeof RTIP !== "undefined" ? RTIP.icon(id, 28) : ICONART.item(id, 28)) : '<span class="lr-i">•</span>'}<span class="nm">${esc(m[1])}${q > 1 ? ` <small>×${q}</small>` : ""}${TI && TI.isTome(id) ? `<small class="ti-line">${esc(TI.line(S, id))}</small>` : ""}</span><span class="num">${it ? +(it.weight * q).toFixed(1) : ""}</span><span class="num gold">${it ? it.value * q : ""}</span></div>`;
    });
    if (r.gold) rows.unshift(`<div class="loot-row"${typeof RTIP !== "undefined" ? RTIP.goldAttr(r.gold) : ""}><span class="lr-i"></span><span class="nm">Gold</span><span></span><span class="num gold">${r.gold}</span></div>`);
    return rows.length ? `<div class="lootbox" role="list" aria-label="Loot"><div class="loot-h"><span></span><span>Loot</span><span>Wt</span><span>Value</span></div>${rows.join("")}</div>` : "";
  }
  function showFightResult(r) {
    shareSpoils(r);
    if (r.fight) { const inf = CURSE.maybeInfect(S, r.fight.e); if (inf) { persist(); setTimeout(() => toast(inf), 1800); } }
    if (r.fight && !r.died && !r.fled && !r.fight.nonlethal) { tally("foes"); warPoint("fight", G.holdAt(livePos())); if (typeof CRISES !== "undefined") CRISES.onFight(S, r.fight.e, G.holdAt(livePos())); if (typeof LONGHOUSE !== "undefined") LONGHOUSE.onFight(S, r.fight.e); if (typeof EXPEDITION !== "undefined") EXPEDITION.hook("fight", { e: r.fight.e, hold: G.holdAt(livePos()) }); if ((r.fight.e?.tags || []).includes("undead")) festCount("undead"); }
    if (r.fight || r.died) SOUND.fight(r); else if (/potion|drink/i.test(r.text || "")) SOUND.fx("potion");
    const skills = skillsHTML(r.skills);
    if (r.died) {
      openModal(`<h2> Defeated</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}<p>${esc(r.died)}</p><button class="btn danger" data-act="close" style="width:100%">Continue</button>`, "enc");
      return;
    }
    if (!r.fight && S.trip?.status === "encounter") return openEncounter(r.text);
    const loot = r.fight ? [r.gold ? `${r.gold} gold` : "", ...(r.loot || [])].filter(Boolean) : [];
    const gotNow = typeof RTIP !== "undefined" ? RTIP.take() : [];   // [rewardtips] road events, quests...: icons for what you were just given
    const gotStrip = !loot.length && gotNow.length ? RTIP.strip(0, gotNow) : "";
    if (typeof BOSSFIGHT !== "undefined") BOSSFIGHT.reveal(r);   // a beaten boss: the big loot card
    openModal(`<h2>${r.title ? esc(r.title) : r.fled ? "Got away" : r.fight ? "Victory" : "Away"}</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}
      ${loot.length ? lootList(r) : gotStrip}${typeof FASTQOL !== "undefined" ? FASTQOL.lootHTML(S, r) : ""}${skills}
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
    return `<div class="refill"><div class="t"> Cleared. Opens again in ${cdSpan(G.now() + left)}</div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div><p class="sub" style="margin:4px 0 0">In-game time: something new moves in on ${esc(G.clockText(G.now() + left))} (about ${realH >= 1 ? Math.round(realH) + " real hour" + (Math.round(realH) === 1 ? "" : "s") : Math.ceil(left / 60) + " real minutes"}).</p></div>`;
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
  let shopMode = "buy", shopCat = "all", tradeCat = "all";
  /* SkyUI-style category strip for the shop and trade windows: All plus the kinds of things on offer */
  function catStrip(cur, act, ids) {
    const have = new Set(ids.filter((i) => D.ITEMS[i]).map((i) => catOf(D.ITEMS[i])));
    const cat = have.has(cur) ? cur : "all";
    const cats = ITEM_CATS.filter(([k]) => k === "all" || have.has(k));
    const bar = cats.length > 2 ? `<div class="sky-cats trade-cats">${cats.map(([k, l]) => `<button class="sky-cat ${k === cat ? "on" : ""}" data-act="${act}" data-id="${k}" aria-label="${l}">${svgI(k)}<span>${l}</span></button>`).join("")}</div>` : "";
    return { bar, ok: (i) => cat === "all" || (D.ITEMS[i] && catOf(D.ITEMS[i]) === cat) };
  }
  const econB = (item) => (typeof ECON !== "undefined" ? ECON.badge(S.location, item) : "");   // ▲/▼ price arrows (economy.js)
  const iqB = (item, r) => (typeof INVQOL !== "undefined" ? INVQOL.badge(S, item, r) : "");   //  kept, ▲/▼ better or worse than worn (invqol.js)
  function barterHTML(shop, open, wanted, shopRow) {
    const wt = Math.round(G.carried(S)), cap = Math.round(G.capacity(S));
    const head = `<div class="barter-head"><span> <b class="gold num">${S.gold}</b> gold</span>${Number.isFinite(wt) && cap ? `<span> ${wt}/${cap}</span>` : ""}</div>
      <div class="seg"><button class="${shopMode === "buy" ? "on" : ""}" data-act="smode" data-id="buy">Buy</button><button class="${shopMode === "sell" ? "on" : ""}" data-act="smode" data-id="sell">Sell</button></div>${typeof INVQOL !== "undefined" ? INVQOL.shopHTML(S, shop, open && !wanted) : ""}`;
    const mk = typeof ECON !== "undefined" ? ECON.report(S, S.location) : "";
    if (shopMode === "buy") {
      const stock0 = typeof TOMES !== "undefined" ? TOMES.stockAt(S.location, shop, S) : D.SHOP_STOCK[shop] || [], stock = typeof SHOPCAP !== "undefined" ? SHOPCAP.filter(stock0) : stock0, cs = catStrip(shopCat, "shopcat", stock);
      return head + cs.bar + mk + (typeof SPELLBOOK !== "undefined" ? SPELLBOOK.shopNote(S, S.location, shop) + (shop === "wizard" ? SPELLBOOK.ritualHTML(S) : "") : "") + stock.filter(cs.ok).map((i) => shopRow(i)).join("");
    }
    const fence = shop === "fence" || (typeof TOWNS !== "undefined" && TOWNS.canFence(S));
    const sellable = G.handable(S).filter((r) => D.ITEMS[r.item] && !["golden_claw", "dragonstone"].includes(r.item) && (!r.stolen || fence)), cs = catStrip(shopCat, "shopcat", sellable.map((r) => r.item));
    const rows = sellable.filter((r) => cs.ok(r.item))
      .map((r) => ({ r, p: G.sellPrice(S, r) })).sort((a, b) => b.p * b.r.qty - a.p * a.r.qty);
    const ok = open && !wanted;
    return head + cs.bar + mk + (rows.length ? rows.map(({ r, p }) => `<div class="item">${ICONART.item(r.item, 34, r)}<div class="t">${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}${r.stolen ? ' <span class="danger-high">stolen</span>' : ""}${iqB(r.item, r)}<span>${esc(G.itemStats(r.item))}${typeof CHARGE !== "undefined" && CHARGE.info(r.item, r) ? " · " + CHARGE.inline(r.item, r, S) : ""} · ${D.ITEMS[r.item].weight} wt</span></div>${econB(r.item)}<span class="num gold">${p}</span><button class="btn sm pri" data-act="sell" data-id="${r.id}" ${ok ? "" : "disabled"}>Sell</button>${r.qty > 1 ? `<button class="btn sm" data-act="sellall" data-id="${r.id}" ${ok ? "" : "disabled"}>All ${G.lotPrice ? G.lotPrice(S, r.item, r.qty, "sell", r) : p * r.qty}</button>` : ""}</div>`).join("")
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
    const songHtml = `<div class="bardsong"><div class="ico-h">${NPCART.portrait(bardOf(l), 44)}<div><h3> Song of the North</h3><span class="sub">${song.final ? `Made from the best verses of ${BARDS.weekName(song.week)}` : "This week's song is still being written"}</span></div></div>
      ${song.lines.length ? `<ol>${song.lines.map((v) => `<li><i>“${esc(v.text)}”</i><small>— ${esc(v.name)}${v.uid === S.id ? " (you)" : ""} ·  ${cnt[v.id] || 0}</small></li>`).join("")}</ol><button class="btn pri" data-act="bardsing" style="width:100%"> Ask the bard to sing it</button>`
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
      return `<div class="verse"><div class="vt"><i>“${esc(v.text)}”</i><small>${esc(v.name)}${own ? " (you)" : ""} · ${esc(v.town || "")} · Day ${v.day}</small>${own ? "" : ` <button class="linkbtn" data-act="chatmute" data-id="${esc(v.uid)}" data-name="${esc(v.name)}">hide this author</button>`}</div><button class="btn sm ${did ? "" : "pri"}" data-act="verselike" data-id="${esc(v.id)}" ${own || did || !Store.online ? "disabled" : ""} aria-label="Cheer"> ${cnt[v.id] || 0}</button></div>`; }).join("")
      : `<p class="sub">No new verses yet.</p>`;
    return `${songHtml}<h3 style="margin-top:12px"> Write a verse</h3>${Store.online ? writeHtml : `<p class="sub">Go online to share verses with other players.</p>`}<h3 style="margin-top:12px">New verses</h3>${listHtml}`;
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
    const left = SMITH.mineLeft(S, l), why = left ? "" : SMITH.mineBlock(S, l);   // tapping still says why, so the button stays live
    const ores = [...new Set(m[1].map(([o]) => D.ITEMS[o].name))].join(", ");
    return `<div class="card"><h3> ${esc(m[0])}</h3><p class="sub" style="margin-top:0">Ore here: ${esc(ores)}. Sometimes a gem.</p>
      ${left ? `<div class="refill"><div class="t">The veins are bare. They grow back in ${cdSpan(G.now() + left)}</div></div>`
        : `<button class="btn ${why ? "" : "pri"}" data-act="mine" style="width:100%">\uE12A Mine ore</button>${why ? `<p class="sub mine-why">${esc(why)}</p>` : ""}`}</div>`;
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
    if (l && !S.trip && WORLD.places[l] && !DUNGEONS.enterable(l)) return `<div class="panel"><h2>${esc(l)}</h2>${PLACEART.scene(l)}<p class="sub" style="margin:0">${esc(G.holdAt(WORLD.places[l]))}${G.shopTypes(l).length || TOWNS.isTown(l) ? " · shops, inn and more in the Area tab" : ""}</p>${solLine ? `<p class="sub">${esc(solLine)}</p>` : ""}</div>${typeof PLACESTUFF !== "undefined" ? PLACESTUFF.card(S) : ""}`;
    if (!l || !DUNGEONS.enterable(l) || S.trip) return "";
    const left = DUNGEONS.refillLeft(S, l), lvl = { 1: 1, 2: 6, 3: 12 }[DUNGEONS.info(l).tier];
    const th = DUNGEONS.info(l).theme, rec = th === "lair" ? 20 : th === "giantcamp" ? 10 : lvl;
    return `<div class="panel" style="border-color:var(--ember)"><h2>${esc(l)}</h2>${PLACEART.scene(l)}<p class="sub">${esc(DUNGEONS.describe(l))} · good from about level ${rec}. Inside, you pick your own way room by room down to the boss. Health doesn't come back on its own in there, and you can leave between rooms whenever you like.</p>
      ${left ? refillCard(l, left) : `<button class="btn danger" data-act="enter" style="width:100%">\uE10E Go inside</button>${coopUI ? coopUI.lobbyHTML(l) : ""}`}${SMITH.MINES[l] ? `<div style="margin-top:10px">${mineHTML(l)}</div>` : ""}${typeof BLACKREACH !== "undefined" ? BLACKREACH.placeCard(S, l) : ""}${!left && typeof DEEPDELVE !== "undefined" ? DEEPDELVE.placeCard(S, l) : ""}</div>`;
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
    const res = dunNote ? `<div class="card res ${dunNote.roomType === "rest" ? "rest" : ""}">${typeof AFFL !== "undefined" && AFFL.scene ? AFFL.scene(dunNote.text) : ""}${dunNote.roomType === "treasure" ? DUNART.chestHTML(chestOpen) : ""}<p>${esc(dunNote.text)}</p>${dunNote.fight ? fightLog(dunNote.fight) : ""}
      ${dunNote.stripLoot?.length || dunNote.stripGold ? DUNART.lootStrip(dunNote.stripGold, dunNote.stripLoot) : ""}${dunNote.loot?.length || dunNote.gold ? `<p class="sub" style="margin:2px 0 0">Loot: ${[dunNote.gold ? dunNote.gold + " gold" : "", ...(dunNote.loot || [])].filter(Boolean).map(esc).join(", ")}</p>` : ""}${skillLine(dunNote)}</div>` : "";
    let main;
    if (d.done) main = `<div class="card"><h3> ${esc(d.place)} is cleared</h3>${DUNART.lootStrip(d.gold, d.found)}<p class="sub">Found so far: ${d.gold} gold${d.found.length ? ", " + d.found.map(esc).join(", ") : ""}.</p><button class="btn pri" data-act="dleave" style="width:100%">Head back outside</button></div>`;
    else if (r && r.type === "camp" && typeof DEEPDELVE !== "undefined") main = DEEPDELVE.campHTML(S);   // deep expedition: Extract / Rest / Descend
    else if (r) {
      const e = r.enemy;
      main = `<div class="card ${e ? "foe" : ""} ${r.type === "rest" ? "rest" : ""}">${typeof DUNROOMS !== "undefined" ? DUNROOMS.room(r.type, d.theme, e) : PLACEART.room(r.type)}<h3>${DUNGEONS.ICON[r.type]} ${e ? esc(e.name) : r.title ? esc(r.title) : DUNGEONS.LABEL[r.type]}</h3><p>${esc(r.text)}</p>
        ${e ? `<div class="vital"><small><span>${esc(e.name)}</span><span class="num">${e.hp}/${e.health} · hits for ~${Math.round(e.damage)}</span></small><div class="bar"><i style="width:100%;background:var(--ember)"></i></div></div>` : ""}
        <div class="evc">${DUNGEONS.roomChoices(S).map(([c, label]) => `<button class="btn ${["fight", "pick", "rest", "read", "pray", "open", "loot", "burn", "dash"].includes(c) || c.startsWith("set:") ? (e ? "danger" : "pri") : ""}" data-act="dact" data-c="${esc(c)}">${esc(label)}</button>`).join("")}</div>
        ${e ? `<p class="sub" style="margin-bottom:0">You play the fight turn by turn.</p>` : ""}</div>`;
    } else {
      const nx = DUNGEONS.nextChoices(S), row = d.rows[d.row + 1];
      main = `<div class="card">${d.row < 0 ? `<div class="dentrance">${PLACEART.scene(d.place, { indoor: true })}</div>` : ""}<h3>${d.row < 0 ? "The entrance" : "Which way?"}</h3><p class="sub">${d.row < 0 ? `You light a torch and step into ${esc(d.place)}.` : "The passage splits."} Tap a glowing room on the map, or pick here:</p>
        ${typeof DUNCHOICE !== "undefined" ? DUNCHOICE.listHTML(S) : `<div class="evc">${nx.map((c) => `<button class="btn ${row[c].type === "boss" ? "danger" : ""}" data-act="droom" data-c="${c}">${DUNGEONS.ICON[row[c].type]} ${DUNGEONS.LABEL[row[c].type]}</button>`).join("")}</div>`}</div>`;   // each way as a card: picture, risk, reward, what's next (dunchoice.js)
    }
    const lvRun = lvUI && d.run && LOOTVOTE.partyRun(coopUI?.runs.find((x) => x.id === d.run));
    const pvOn = !!(pvUI && d.run && pvUI.showing());   // a party vote is open: everyone sees the choices and votes
    if (coopUI && d.run) { if (!d.done && !r && coopUI.waiting() && !pvOn) main = coopUI.waitHTML(); else if (!d.done && !r) main = coopUI.behindHTML() + main; if (d.done) main += lvRun ? `<div class="card coop"><h3>\uE177 Party loot</h3><p class="sub">Everything the party found is in one pile. The vote opens for everyone now: tap Want on what you'd like. Gold is split evenly.</p></div>` : coopUI.chestHTML(); }
    if (lvRun && r && !d.done && lvUI.memberLocked() && !pvOn) main = lvUI.lockedHTML() + main.replace(/<div class="evc(?: [^"]*)?">[\s\S]*?<\/div>/, "");
    if (pvOn) main = pvUI.main(main);
    el.innerHTML = `<div class="in dgrid"><div class="dcol">
      <div class="hd"><h2>\uE10E ${esc(d.place)}</h2><button class="btn sm" data-act="dmin">\uE152 Pack</button>${d.done || r?.type === "boss" ? "" : `<button class="btn sm" data-act="dleave">Leave</button>`}</div>
      <div class="vital"><small><span>Health${r ? "" : " · no natural healing in here"}</span><span class="num">${Math.round(hp)}/${mh}</span></small><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--hp)"></i></div></div>
      ${typeof DEEPDELVE !== "undefined" ? DEEPDELVE.bannerHTML(S) : ""}${coopUI && d.run ? coopUI.bar() : ""}<p class="sub" style="margin:0">Room ${step} of ${total} · found ${d.gold} gold${d.found.length ? ` and ${d.found.length} item${d.found.length > 1 ? "s" : ""}` : ""} · ${G.countRestore(S, "health")} healing potions</p>
      ${typeof DUNSTRIP !== "undefined" ? DUNSTRIP.html(d) : ""}${res}${main}</div>
      <div class="card dmapcard">${DUNART.legendHTML(d)}<div class="dmapfit">${DUNART.mapHTML(d)}</div></div>
    </div>`;
    el.scrollTop = 0;
    DUNART.after(el, reduceMotion);
    if (typeof DUNFX !== "undefined") DUNFX.attach(el, d.theme, reduceMotion);   // dust, drips or embers instead of weather
    if (pvUI) pvUI.paint();
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
  /* a room choice, with its mini-game when it has one (also how a settled party vote is carried out, partyvote.js) */
  function dunChoice(dc) {
    const dg = typeof DGAMES !== "undefined" && !(lvUI && lvUI.memberLocked());   // dungeon mini-games; the party watches the leader play (dungeongames.js)
    if (dg && typeof PTRAPS !== "undefined" && PTRAPS.wants(S, dc)) return PTRAPS.start(S, dc, dungeonAct);   // a trap in a party run: everyone plays it (partytraps.js)
    if (dg && DGAMES.handles(S, dc)) return DGAMES.play(S, dc, dungeonAct);
    if (dc.startsWith("game:") && typeof EXPLORE !== "undefined") { EXPLORE.openGame(S, dungeonAct); if (dg) DGAMES.mirror("ring"); return; }
    if (dc === "pick" && typeof IMM !== "undefined" && IMM.wantsGame()) { IMM.pick("dungeon", dungeonAct, S); if (dg) DGAMES.mirror("lock"); return; }
    dungeonAct(dc);
  }
  /* Gather by hand: the harvest mini-game (harvestgame.js), then the pick with how it went. Started in reach, so it still
     counts if the road carries you on while you work (walking or riding). */
  function harvestHand(id) {
    const n = GATHER.nearby(S).find((x) => x.id === id);
    if (!n || n.d > GATHER.REACH_PX + 1) return toast("That patch is too far away. Walk closer.");
    if (!n.ripe) return toast("Already picked. It grows back in a couple of days.");
    const before = HARVEST.progress(S, n.ing);
    HARVESTGAME.open({ ing: n.ing, kind: HARVEST.kindOf(n.ing), name: D.ITEMS[n.ing]?.name || n.ing, tol: HARVEST.tolOf(S), fast: HARVEST.tolOf(S) > 1,
      onDone: (grade) => {
        let r; try { r = GATHER.act(S, "gpick", id, undefined, { grade, passing: true }); } catch (e) { console.error(e); r = { err: "Couldn't gather that. Please try again." }; }
        if (r.ok) { G.note(S, ` ${r.text}`); SOUND.fx("coin"); persist(true); renderPanel(true); }
        return { ...r, before, after: HARVEST.progress(S, n.ing), thumb: G.P(S, "green_thumb") > 0 };
      } });
  }
  function gatherAct(what, id) {
    if (what === "gpick" && typeof HARVESTGAME !== "undefined" && typeof HARVEST !== "undefined" && HARVESTGAME.ok()) {
      try { return harvestHand(id); } catch (e) { console.error(e); }   // if the mini-game can't start, fall back to a plain pick below
    }
    let r; try { r = GATHER.act(S, what, id); } catch (e) { console.error(e); return toast("Couldn't gather that. Please try again."); }   // never a silent dead button
    if (r.html) return openModal(r.html);
    if (r.err) return toast(r.err);
    SOUND.fx(what === "gauto" || what === "gunplant" ? "click" : "coin");
    if (r.ok && /^(g(pick|quick|pickall|forage|plant)|hdeliver)$/.test(what)) G.note(S, ` ${r.text}`);
    persist(true); renderPanel(true); toast(r.text);
  }
  function exploreAct(what, id) {
    const r = EXPLORE.act(S, what, id);
    if (r.html) return openModal(r.html);
    if (r.err) return toast(r.err);
    SOUND.fx(r.got ? "coin" : "click");
    if (r.got) G.note(S, ` ${r.text}`);
    persist(true); renderPanel(true);
    openModal(`<h2>${what === "xdig" ? " Buried treasure" : " Searching"}</h2><p>${esc(r.text)}</p>${r.book ? `<button class="btn" data-act="xread" data-id="${esc(r.book.id)}" style="width:100%;margin-bottom:6px"> Read "${esc(r.book.title)}"</button>` : ""}<button class="btn pri" data-act="close" style="width:100%">Continue</button>`);
  }
  function dungeonAct(c, replay = false) {
    if (lvUI && !replay && lvUI.memberLocked()) return toast("In a party, everyone votes on each choice. Wait for the vote to open on your screen.");
    if (replay && typeof PTRAPS !== "undefined" && coopUI && S.dungeon?.run) c = PTRAPS.mine(S, coopUI.runs.find((x) => x.id === S.dungeon.run), c, PTRAPS.docs);   // a party trap: your own result, not the leader's
    const runId = S.dungeon?.run || null, roomType = S.dungeon?.room?.type, hp0 = G.curHealth(S), found0 = S.dungeon?.found.length || 0, gold0 = S.dungeon?.gold || 0;
    const act = () => {   // the party loot pile wraps the room; a fight inside it pauses on the turn-by-turn screen
      let r, err; const p = lvUI ? lvUI.aroundAct(c, () => { try { return (r = DUNGEONS.act(S, c)); } catch (x) { err = x; throw x; } }) : (r = DUNGEONS.act(S, c));
      p?.catch?.((x) => { if (x !== err) console.warn(x); }); if (err) throw err; return r;
    };
    if (replay) return dungeonDone(typeof NOAUTO !== "undefined" ? NOAUTO.carried(act) : act(), runId, roomType, hp0, found0, gold0);   // members follow the leader's choice: its fight was played on the shared fight screen, the AI doesn't fight it again (noautoplay.js)
    tbCall(act, (r) => dungeonDone(r, runId, roomType, hp0, found0, gold0));
  }
  function dungeonDone(r, runId, roomType, hp0, found0, gold0) {
    if (typeof DGAMES !== "undefined") DGAMES.result(r);   // the party watching the leader's mini-game reads what happened
    if (r.cleared && runId) S.lastRun = runId;
    if (S.dungeon) { const newFound = S.dungeon.found.slice(found0); r.stripLoot = [...new Set([...(r.loot || []), ...newFound])]; r.stripGold = r.gold || (S.dungeon.gold - gold0) || 0; }
    r.roomType = roomType; r.hurt = roomType === "trap" && G.curHealth(S) < hp0 - 0.5;
    if (r.fight) { const inf = CURSE.maybeInfect(S, r.fight.e); if (inf) setTimeout(() => toast(inf), 1800); }
    if (r.fight && !r.died) shareSpoils(r);
    if (r.fight && !r.died) { tally("foes"); warPoint("fight", G.holdAt(WORLD.places[S.dungeon?.place] || livePos())); if (typeof EXPEDITION !== "undefined") EXPEDITION.hook("fight", { e: r.fight.e, hold: G.holdAt(WORLD.places[S.dungeon?.place] || livePos()) }); if ((r.fight.e?.tags || []).includes("undead")) festCount("undead"); }
    if (r.fight || r.died) SOUND.fight(r); else if (r.trap || /trap|dart|blade/i.test(r.text || "")) SOUND.fx("hit");
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (typeof SHOUTS2 !== "undefined") SHOUTS2.showWallWhenFree();   // a Word Wall was read: its scene after the result
    if (runId && coopUI) coopUI.afterAct(r, runId);
    if (r.died) { dunNote = null; closeDungeon(); renderPanel(true); openModal(`<h2> Defeated</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}<p>${esc(r.died)}</p><button class="btn danger" data-act="close" style="width:100%">Continue</button>`, "enc"); return; }
    if (r.partyChest && party) {
      const id = `${S.id}-${Math.floor(G.now())}`;
      Store.put("chests", id, { gold0: r.partyChest.gold, items0: r.partyChest.items, goldLeft: r.partyChest.gold, itemsLeft: r.partyChest.items, taken: [],
        members: party.members, place: S.dungeon?.place || "", byName: S.name, t: G.now() });
      postNews(` ${S.name}'s party cleared ${S.dungeon?.place}. The chest is waiting to be shared.`);
    } else if (r.partyChest) { S.gold += r.partyChest.gold; r.partyChest.items.forEach((i) => G.give(S, i)); }
    if (r.cleared) { tally("dungeons"); warPoint("dungeon", G.holdAt(WORLD.places[S.dungeon?.place] || livePos())); if (typeof EXPEDITION !== "undefined") EXPEDITION.hook("dungeon", { place: S.dungeon?.place, hold: G.holdAt(WORLD.places[S.dungeon?.place] || livePos()) }); const jm = TOWNS.checkJobs(S); if (jm.length) { tally("jobs", jm.length); r.text += " " + jm.join(" "); } postNews(` ${S.name} cleared ${S.dungeon?.place}.`); }
    persist(true);
    if (typeof BOSSFIGHT !== "undefined") BOSSFIGHT.reveal(r);   // the boss room: the big loot card
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
    alteration: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/>', conjuration: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>', illusion: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', mysticism: '<circle cx="12" cy="12" r="8"/><path d="M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5z"/>', support: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    powers: '<path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>', shouts: '<path d="M4 9v6h4l6 5V4L8 9zM17 8a5 5 0 010 8M19 5a9 9 0 010 14"/>', effects: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
    combat: '<path d="M5 19L19 5M14 5h5v5"/>', magic: '<circle cx="12" cy="12" r="8"/><path d="M12 4l2 8-2 8-2-8z"/>', stealth: '<path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/>', other: '<circle cx="12" cy="12" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.misc}</svg>`;
  const ITEM_CATS = [["gear", "Worn"], ["all", "All"], ["weapons", "Weapons"], ["apparel", "Apparel"], ["potions", "Potions"], ["scrolls", "Scrolls"], ["food", "Food"], ["ingredients", "Ingredients"], ["books", "Books"], ["misc", "Misc"]];
  const catOf = (it) => it.slot === "food" ? "food" : it.slot === "weapon" || it.slot === "ammo" ? "weapons" : G.ARMOR_SLOTS.includes(it.slot) || it.slot === "ring" || it.slot === "amulet" ? "apparel" : ["potion", "poison"].includes(it.slot) ? "potions"
    : it.slot === "scroll" ? "scrolls" : it.slot === "tome" || it.slot === "recipe" ? "books" : it.slot === "ingredient" ? "ingredients" : "misc";
  const MAGIC_CATS = [["all", "All"], ["destruction", "Destruction"], ["restoration", "Restoration"], ["alteration", "Alteration"], ["conjuration", "Conjuration"], ["illusion", "Illusion"], ["mysticism", "Mysticism"], ["support", "Support"], ["powers", "Powers"], ["shouts", "Shouts"], ["effects", "Active effects"]];
  const SKILL_CATS = [["all", "All"], ["combat", "Warrior"], ["magic", "Mage"], ["stealth", "Thief"], ["other", "Other"]];
  const SKILL_GROUP = { combat: "Warrior", magic: "Mage", stealth: "Thief" };
  function openMenu(page = "items") { SOUND.fx("page"); sky = { ...sky, page, cat: page === "items" ? "gear" : "all", sel: null, q: page === sky.page ? sky.q : "" }; renderMenu(); }
  function closeMenu() { if ($("#sky")) { $("#sky").remove(); if (typeof MENUS !== "undefined") MENUS.skyOn(null); } }
  function itemStat(r) {
    const it = D.ITEMS[r.item];
    if (it.slot === "weapon") return it.damage + (r.temper || 0);
    if (G.ARMOR_SLOTS.includes(it.slot)) return (it.armor || 0) + (r.temper || 0);
    if (it.restore) return it.restore[1];
    if (it.effects) return it.effects[0][1];
    if (it.slot === "soulgem") return it.charge;
    return null;
  }
  /* [OURS] dual wielding: one-handed weapons can go in your left hand (instead of a shield) */
  function offhandBtn(r, it, sm) {
    if (!G.canOffhand || !G.canOffhand(it)) return "";
    const eq = G.loadout(S).equipment;
    if (eq.offhand === r.id) return `<button class="btn${sm}" data-act="uneq" data-slot="offhand">Out of left hand</button>`;
    const main = eq.weapon != null && D.ITEMS[G.invRow(S, eq.weapon)?.item]?.hands === 2;
    return main ? "" : `<button class="btn${sm}" data-act="eqoff" data-id="${r.id}" title="Hold it in your left hand: every attack follows up with a second blow. Takes the place of a shield."> Left hand</button>`;
  }
  function itemRows() {
    const eqIds = new Set(Object.values(G.loadout(S).equipment));
    const q = (sky.q || "").toLowerCase();
    let rows = S.inv.filter((r) => D.ITEMS[r.item] && (sky.cat === "all" || catOf(D.ITEMS[r.item]) === sky.cat) && (!q || ((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name).toLowerCase().includes(q))).map((r) => {
      const it = D.ITEMS[r.item];
      const weight = +(it.weight * r.qty).toFixed(2), arm = G.ARMOR_SLOTS.includes(it.slot) ? (it.armor || 0) + (r.temper || 0) : null;
      return { id: r.id, r, it, name: (r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + it.name + (r.nm ? ` “${r.nm}”` : ""), stat: itemStat(r), weight, value: it.value, eq: eqIds.has(r.id),
        dmg: it.slot === "weapon" ? it.damage + (r.temper || 0) : null, arm, ratio: +(it.value * r.qty / Math.max(0.1, weight)).toFixed(1), new: r.id };
    });
    if (typeof MENUS2 !== "undefined") return MENUS2.sortItems(rows, sky.sort, sky.dir || 1);   // menus2.js: one sort row
    const k = sky.sort, d = sky.dir;
    rows.sort((a, b) => (b.eq - a.eq) || (k === "name" ? a.name.localeCompare(b.name) * d : (((a[k] ?? -1) - (b[k] ?? -1)) * -d) || a.name.localeCompare(b.name)));
    return typeof INVQOL !== "undefined" && S.invSort ? INVQOL.sorted(S, rows, (x) => x.r).sort((a, b) => b.eq - a.eq) : rows;   // pack sort chips (invqol.js)
  }
  function itemDetail(row) {
    const { r, it } = row, eq = row.eq;
    const canShop = S.location && G.shopTypes(S.location).length && (G.shopsOpen() || (typeof RUMOURS !== "undefined" && RUMOURS.knocked(S)));
    const gems = S.inv.filter((x) => D.ITEMS[x.item]?.slot === "soulgem");
    const stats = [];
    const hitN = it.slot === "weapon" && !it.staff && typeof ITEMCMP !== "undefined" ? ITEMCMP.hits(S, r.item, r) : 0;   // [itemcards2] the with-skill number, as in the compare
    if (it.slot === "weapon") stats.push(hitN ? ["Hits for", `${hitN} (${it.damage + (r.temper || 0)} base)`] : ["Damage", it.damage + (r.temper ? ` (+${r.temper})` : "")], ["Skill", it.skill], ["Hands", it.hands === 2 ? "Two" : "One"]);
    if (G.ARMOR_SLOTS.includes(it.slot)) stats.push(["Armor", (it.armor || 0) + (r.temper ? ` (+${r.temper})` : "")], ["Type", it.type || "—"], ["Slot", it.slot]);
    if (it.slot === "ring" || it.slot === "amulet") stats.push(["Slot", it.slot === "ring" ? "Ring (two can be worn)" : "Amulet"]);
    stats.push(["Weight", +(it.weight * r.qty).toFixed(2)], ["Value", it.value]);
    if (r.qty > 1) stats.push(["Count", r.qty]);
    const lines = [];
    if (it.enchant) lines.push(`${ENCH.lines ? ENCH.lines(it)[0] : `${it.enchant.magnitude} ${it.enchant.effect} damage per hit`}${typeof CHARGE !== "undefined" ? "" : ` Charge ${Math.round(100 * (r.charge || 0) / it.enchant.capacity)}%.`}`);
    if (it.staff) lines.push(`Casts ${D.SPELLS[it.staff.spell].name} instead of swinging${typeof CHARGE !== "undefined" ? "" : ` · charge ${Math.round(100 * MAGIC.staffCharge(r) / it.staff.capacity)}% (${Math.floor(MAGIC.staffCharge(r) / it.staff.perCast)} casts)`}`);
    if (it.aenchant) lines.push(`While worn: ${ENCH.lines ? ENCH.lines(it).join(" ") : [it.aenchant, ...(it.aenchant.more || [])].map((e) => e.key.startsWith("dae:") ? e.name : `${e.name} ${e.mag}`).join(" · ")}`);
    else if ((it.slot === "ring" || it.slot === "amulet") && !it.unique) lines.push(`Plain ${it.slot === "ring" ? "ring" : "amulet"}: an arcane enchanter can put magic on it${(it.jpow || 1) > 1 ? ` (holds ${Math.round(((it.jpow || 1) - 1) * 100)}% more magic than plain silver)` : ""}.`);
    if (it.desc) lines.push(it.desc);   // Daedric artifacts and other named items
    if (it.slot === "weapon" && typeof ITEMCMP !== "undefined" && ITEMCMP.hits(S, r.item, r)) lines.push(`Hits for about ${ITEMCMP.hits(S, r.item, r)} with your ${it.skill} skill and perks`);   // [itemdetail] the number the compare uses
    if (it.effects) lines.push(it.effects.map(([e, m, dd]) => `${e} ${m}${dd * 5 >= 60 ? ` for ${Math.round(dd * 5 / 60)} min` : ""}`).join(" · "));
    else if (it.restore) lines.push(`Restores ${it.restore[1]} ${it.restore[0]}`);
    if (it.slot === "scroll" || (it.slot === "tome" && !TI)) lines.push(`${it.slot === "tome" ? "Teaches" : "Casts"} ${D.SPELLS[it.spell].name}${it.slot === "tome" && S.spells.includes(it.spell) ? " (you know it)" : ""}`);
    if (it.slot === "ingredient" && TOWNS.INGREDIENT_FX[r.item]) lines.push("Effects: " + TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? e : "?").join(", ") + (typeof GATHER !== "undefined" && GATHER.WHERE[r.item] ? ` · Found: ${GATHER.WHERE[r.item]}` : ""));
    if (it.slot === "material") lines.push("Used at the forge to improve gear.");
    if (r.stolen) lines.push("Stolen. Only a fence will buy it.");
    if (it.slot === "recipe" && typeof CRAFTFAIR !== "undefined") lines.push(CRAFTFAIR.knows(S, it.recipe) ? "You already know these forge recipes." : `Read it to learn new forge recipes: ${Object.keys(SMITH.RECIPES).filter((k) => SMITH.RECIPES[k].needs === it.recipe).map((k) => D.ITEMS[k].name).join(", ")}.`);
    if (r.cv != null && it.slot !== "potion") lines.push(`You made this. Shops pay no more than its materials were worth${r.nm ? "" : ", but you can give it a name"}.`);
    if (typeof TREASURE !== "undefined") lines.push(...TREASURE.detailLines(S, r));   // treasure maps and relics (treasure.js)
    const acts = [];
    const onMain = eq && !(G.loadout(S).equipment.offhand === r.id && G.loadout(S).equipment[it.slot] !== r.id);
    if (G.SLOTS.includes(it.slot)) acts.push(onMain ? `<button class="btn" data-act="uneq" data-slot="${it.slot}" data-id="${r.id}">Unequip</button>` : `<button class="btn pri" data-act="eq" data-id="${r.id}">Equip${G.canOffhand(it) ? " (right hand)" : ""}</button>`);
    acts.push(offhandBtn(r, it, ""));
    if (typeof TREASURE !== "undefined") acts.push(...TREASURE.detailActs(S, r));
    if (it.slot === "tome") acts.push(`<button class="btn pri" data-act="read" data-id="${r.id}">Read</button>`);
    if (it.slot === "recipe") acts.push(`<button class="btn pri" data-act="cfread" data-id="${r.id}">Read</button>`);
    if (typeof CRAFTFAIR !== "undefined" && CRAFTFAIR.canName(r)) acts.push(`<span class="cf-name"><input id="cfname-${r.id}" maxlength="${CRAFTFAIR.NAME_MAX}" placeholder="Name it" value="${esc(r.nm || "")}" aria-label="Name for this item"><button class="btn" data-act="cfname" data-id="${r.id}">${r.nm ? "Rename" : "Name it"}</button></span>`);
    if (it.slot === "potion") acts.push(`<button class="btn pri" data-act="drinkrow" data-id="${r.id}">Drink</button>`);
    if (it.slot === "poison") acts.push(`<button class="btn pri" data-act="poison" data-id="${r.id}">Coat weapon</button>`);
    if (it.slot === "ingredient") acts.push(`<button class="btn" data-act="eat" data-id="${r.id}">Eat</button>`);
    if (it.slot === "food" && r.item !== "fishing_rod") acts.push(`<button class="btn pri" data-act="eatfood" data-id="${r.id}">Eat${it.dish ? "" : " (raw)"}</button>`);
    if (it.dish) lines.push(`${it.desc}. A new meal replaces the last one's effect.`);
    if (it.enchant || it.staff) acts.push(...gems.map((g) => `<button class="btn" data-act="recharge" data-id="${r.id}" data-gem="${g.id}">Recharge (${esc(D.ITEMS[g.item].name.split(" (")[0])})</button>`));
    if (canShop && G.freeQty(S, r.id) > 0) acts.push(`<button class="btn" data-act="sell" data-id="${r.id}">Sell · ${G.sellPrice(S, r)} gold</button>`);   // worn gear is never sold
    if (typeof INVQOL !== "undefined") acts.push(...INVQOL.acts(S, r, eq, false));   // Keep / Drop (invqol.js)
    if (typeof ECON !== "undefined" && !it.noTrade && !["golden_claw", "dragonstone"].includes(r.item)) { const bp = ECON.bestPlace(S, r); if (bp && bp.p > 1) lines.push(`Sells best in ${bp.to} right now (about ${bp.p} gold each).`); }
    return `<div class="sky-detail"><div class="sky-ico">${ICONART.item(r.item, 64, r)}</div><h3 class="q-${typeof CC !== "undefined" ? CC.tier(r.item, r) : "common"}">${esc(row.name)}</h3>${typeof CC !== "undefined" ? `<p class="tierline q-${CC.tier(r.item, r)}">${CC.TIER_NAME[CC.tier(r.item, r)]}${r.stolen ? ' · <span class="is-stolen">Stolen</span>' : ""}</p>` : ""}<div class="sky-stats">${stats.map(([k, v]) => `<div><span>${k}</span><b class="num">${esc(String(v))}</b></div>`).join("")}</div>
      ${lines.map((l) => `<p class="sub">${esc(l)}</p>`).join("")}${typeof CHARGE !== "undefined" ? CHARGE.detail(r.item, r, S) : ""}${it.slot === "tome" && TI ? TI.html(S, r.item, { head: false }) : ""}${typeof ITEMCMP !== "undefined" ? ITEMCMP.html(S, r) : ""}${gearPreview(r, it, eq)}<div class="sky-acts">${acts.join("")}</div></div>`;
  }
  /* [itemdetail] PC: the mouse rests on an Items row: show it in the side panel (only the panel is redrawn, the list keeps its scroll) */
  function skyPreview(id) {
    const el = $("#sky"); if (!el || sky.page !== "items" || sky.cat === "gear" || sky.sel != null || id == null) return;
    if (String(sky.hov) === String(id) && el.querySelector(".sky-in>.sky-detail")) return;
    sky.hov = id;
    const row = itemRows().find((r) => String(r.id) === String(id)); if (!row) return;
    const old = el.querySelector(".sky-in>.sky-detail, .sky-in>.m2-pick"); if (!old) return;
    const t = document.createElement("div"); t.innerHTML = itemDetail(row);
    const nu = t.firstElementChild; if (!nu) return;
    nu.classList.add("ic-hover"); old.replaceWith(nu);
  }
  /* [gear] a paper doll of you wearing this piece, next to you as you are now — what others will see */
  function gearPreview(r, it, eq) {
    if (typeof HEROART === "undefined" || !["weapon", "shield", "head", "chest", "hands", "feet"].includes(it.slot)) return "";
    const L = HEROART.lookOf(S), base = r.item.startsWith("ench|") ? r.item.split("|")[1] : r.item;
    const tryL = { ...L, id: L.id, eq: { ...L.eq, [it.slot]: base } };
    if (it.slot === "weapon" && it.hands === 2) delete tryL.eq.shield;
    const setN = typeof GEARLOOK !== "undefined" ? GEARLOOK.set(GEARLOOK.setOf(base)).n : "";
    return `<div class="gearprev">${eq ? "" : `<figure>${HEROART.figure({ look: L }, 84, 116)}<figcaption>Now</figcaption></figure>`}<figure>${HEROART.figure({ look: tryL }, 84, 116)}<figcaption>${eq ? "Worn" : "With this"}${setN ? ` · ${esc(setN)}` : ""}</figcaption></figure></div>`;
  }
  // ---- magic
  // pictures for spells, powers, shouts and stones in menus (uiart.js)
  function magicIcon(id, size = 24) {
    const [k, a] = String(id).split(":");
    if (k === "spell") return UIART.spell(a, size);
    if (k === "shout") return UIART.shout(a, size);
    if (k === "power") return a === "stone" && S.stone ? UIART.stone(S.stone, size) : a === "race" ? (UIART.racePower ? UIART.racePower(S.race, size) : UIART.power(S.race, size)) : UIART.action(a === "lord" ? "power:lord" : "power:beast", size);
    if (k === "fx" && a === "stone" && S.stone) return UIART.stone(S.stone, size);
    return "";
  }
  function magicRows() {
    const out = [];
    for (const id of S.spells) { const sp = D.SPELLS[id]; if (!sp) continue; out.push({ id: `spell:${id}`, cat: sp.school.toLowerCase(), name: sp.name, cost: sp.kind === "utility" ? null : G.spellCost(S, sp), sub: `${sp.school} · ${sp.level || "Novice"}${typeof SPELLBOOK !== "undefined" && SPELLBOOK.SUPPORT.has(sp.kind) ? " · on allies" : ""}`, school: sp.school, el: sp.element, tier: sp.level || "Novice", support: typeof SPELLBOOK !== "undefined" && SPELLBOOK.SUPPORT.has(sp.kind) }); }
    out.push({ id: "power:race", cat: "powers", name: POWERS.RACE[S.race][0], cost: null, sub: POWERS.powerReady(S, "race") ? "Ready" : "Used today" });
    if (S.werewolf) out.push({ id: "power:beast", cat: "powers", name: "Beast Form", cost: null, sub: CURSE.beastReady(S) ? "Ready" : "Used today" });
    if (S.vampire && CURSE.lordReady) out.push({ id: "power:lord", cat: "powers", name: "Vampire Lord", cost: null, sub: CURSE.lordReady(S) ? "Ready" : "Used today" });
    if (POWERS.stoneHasPower(S)) out.push({ id: "power:stone", cat: "powers", name: POWERS.STONES[S.stone][0], cost: null, sub: POWERS.powerReady(S, "stone") ? "Ready" : "Used today" });
    for (const [id, [name, words]] of Object.entries(POWERS.SHOUTS)) if (words.some((w) => POWERS.known(S, w))) out.push({ id: `shout:${id}`, cat: "shouts", name, cost: null, sub: words.map((w) => POWERS.known(S, w) ? (POWERS.unlocked(S, w) ? w : w + "") : "···").join(" ") });
    if (sky.cat === "shouts") {   // the shouts still out there, with where to look (shouts2.js), and your dragon souls
      out.unshift({ id: "fx:souls", cat: "shouts", name: `Dragon souls: ${S.souls || 0}`, cost: null, sub: `Words known ${(S.words || []).length} · unlocked ${(S.unlocked || []).length}` });
      for (const [id, [name]] of Object.entries(POWERS.SHOUTS)) if (!POWERS.SHOUTS[id][1].some((w) => POWERS.known(S, w)) && id !== "bend_will") out.push({ id: `shout:${id}`, cat: "shouts", name: `${name} · not learned`, cost: null, sub: "··· ··· ···" });
    }
    const t = G.now();
    for (const f of (S.fx || []).filter((f) => f.until > t)) out.push({ id: `fx:${f.name}:${f.until}`, cat: "effects", name: f.name, cost: null, sub: `${f.mag} · ${Math.ceil((f.until - t) / 60)} min` });
    for (const g of gearFx()) out.push({ id: `fx:gear:${g.from}:${g.key}`, cat: "effects", name: fxLabel(g), cost: null, sub: `Worn: ${g.from}` });
    if (G.rested(S)) out.push({ id: "fx:rested", cat: "effects", name: (S.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested", cost: null, sub: `${Math.ceil((S.rested - t) / 60)} min` });
    if (S.stone) out.push({ id: "fx:stone", cat: "effects", name: POWERS.STONES[S.stone][0], cost: null, sub: "Standing stone" });
    const tierOk = (r) => !sky.tier || sky.tier === "all" || r.tier === sky.tier;
    const res = out.filter((r) => (sky.cat === "all" ? !r.id.startsWith("fx:") : sky.cat === "support" ? r.support : r.cat === sky.cat) && tierOk(r));
    const q = (sky.q || "").trim().toLowerCase(), res2 = q ? res.filter((r) => r.name.toLowerCase().includes(q)) : res;
    if (typeof MENUS2 !== "undefined") { const o = MENUS2.sortMagic(res2, sky.msort || "name", sky.mdir || 1); return [...o.filter((r) => r.id === "fx:souls"), ...o.filter((r) => r.id !== "fx:souls")]; }   // menus2.js: Name / Cost / School, ▲▼ (dragon souls stay on top)
    if (sky.msort === "cost") res2.sort((a, b) => (a.cost ?? 1e9) - (b.cost ?? 1e9) || a.name.localeCompare(b.name));
    return res2;
  }
  function magicDetail(row) {
    const [kind, arg] = row.id.split(":");
    let desc = "", acts = [], spellNums = "";
    if (kind === "spell") {
      const sp = D.SPELLS[arg];
      const fail = MAGIC.failChance(S, arg);
      desc = `${sp.level || "Novice"} ${sp.school}${sp.kind === "utility" ? ` · ${MAGIC.describe(sp)} · no magicka: a short rest between casts` : ""}${fail ? ` ·  above your ${sp.school} (${G.skill(S, sp.school)} of ${MAGIC.REQ[sp.level]}): costs more and fizzles ${Math.round(fail * 100)}% of the time` : ""}`;
      spellNums = sp.kind === "utility" ? "" : MAGIC.infoHTML(S, arg);
      if (MAGIC.outOfFight(sp)) { const cd = MAGIC.cdLeft(S, arg); acts.push(`<button class="btn pri" data-act="castout" data-id="${esc(arg)}" ${cd ? "disabled" : ""}>${cd ? `Ready in ${Math.ceil(cd)} s` : "Cast now"}</button>`); }
    } else if (kind === "power") desc = arg === "race" ? POWERS.RACE[S.race][1] + " Once a day." : POWERS.STONES[S.stone][1];
    else if (kind === "shout") {
      const sh = POWERS.SHOUTS[arg], lv = POWERS.level(S, arg);
      const findIt = typeof SHOUTS2 !== "undefined" && sh[1].some((w) => !POWERS.known(S, w)) ? ` Where to learn more: ${SHOUTS2.hint(S, arg)}` : "";
      desc = `${sh[3]} ${lv ? `You can shout ${lv} word${lv > 1 ? "s" : ""}; cooldown ${typeof SHOUTS !== "undefined" ? SHOUTS.cd(S, arg, lv) : sh[2][lv - 1]} s.` : sh[1].some((w) => POWERS.known(S, w)) ? "Unlock its first word with a dragon soul." : "You don't know any of its words yet."}${findIt}`;
      acts.push(...sh[1].filter((w) => POWERS.known(S, w) && !POWERS.unlocked(S, w)).map((w) => `<button class="btn" data-act="unlock" data-id="${w}" ${(S.souls || 0) > 0 ? "" : "disabled"}>Unlock ${w} (dragon soul: ${S.souls || 0})</button>`));
      if ((typeof SHOUTS !== "undefined" ? SHOUTS.outside(arg) : POWERS.ROAD_SHOUTS.includes(arg)) && lv) acts.push(`<button class="btn pri" data-act="roadshout" data-id="${arg}" ${POWERS.voiceReady(S) ? "" : "disabled"}>Shout now</button>`);
    } else return `<div class="sky-detail"><h3>${esc(row.name)}</h3><p class="sub">${esc(row.sub)}</p></div>`;
    return `<div class="sky-detail">${magicIcon(row.id, 64) ? `<div class="sky-ico">${magicIcon(row.id, 64)}</div>` : ""}<h3>${esc(row.name)}</h3><p class="sub">${esc(desc)}</p>${spellNums}<div class="sky-acts">${acts.join("")}</div></div>`;
  }
  // ---- what your worn gear and potions add (shown next to skills)
  function gearFx() {
    const out = [];
    for (const id of Object.values(G.loadout(S).equipment || {})) { const r = G.invRow(S, id), it = r && D.ITEMS[r.item]; if (it?.aenchant) for (const e of [it.aenchant, ...(it.aenchant.more || [])]) if (!e.key.startsWith("dae:")) out.push({ name: e.name, mag: e.mag, key: e.key, from: it.name }); }   // masks carry several
    return out;
  }
  const FX_UNIT = (key) => key.startsWith("dmg:") ? "% damage" : key.startsWith("spell:") ? "% stronger spells" : key === "barter" ? "% better prices" : key === "resist" ? "% resist magic" : key === "carry" ? " carry weight" : key.startsWith("max:") ? " " + key.slice(4) : key.startsWith("skill:") ? " skill" : key.startsWith("cost:") ? "% cheaper" : key.startsWith("regen:") ? "% faster regen" : key.startsWith("pfx:") ? ({ "pfx:block": "% block", "pfx:crit": "% crit chance", "pfx:evasion": "% dodge" }[key] || "% resist") : "";
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
    return `<div class="sinfo"><p class="sinfo-what">${UIART.skill(sk, 36)}<span>${esc(i.what)}</span></p>${i.now.length ? `<h4>What you have now</h4><ul>${i.now.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      <h4>How to raise it</h4><ul>${i.raise.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${i.perks ? `<p class="sub">Perks: ${esc(i.perks)}</p>` : ""}${legendHTML(sk)}</div>`;
  }
  /* Legendary skills (legendary.js): at 100, start the skill again for a permanent star */
  let legendArm = null;
  function legendHTML(sk) {
    if (typeof LEGEND === "undefined") return "";
    const r = LEGEND.row(S, sk), st = r.stars ? `<p class="sub leg-st"><b class="leg-stars">${LEGEND.starText(r.stars)}</b> Legendary ${r.stars}× · +${r.bonus} to ${esc(sk)} for good</p>` : "";
    if (!r.ready) return st + (r.lvl >= 80 ? `<p class="sub">At 100 you can make ${esc(sk)} Legendary: it starts again from ${LEGEND.START}, keeps your perks and gives +${LEGEND.BONUS_PER_STAR} for good.</p>` : "");
    const armed = legendArm === sk;
    return `${st}<div class="leg-box"><p><b>${esc(sk)} is at 100.</b> Make it Legendary: it drops to ${LEGEND.START} and grows again (so your level keeps rising), you keep your perks, and you get +${LEGEND.BONUS_PER_STAR} ${esc(sk)} for good${r.bonus >= LEGEND.MAX_BONUS ? " (bonus already at its most: a star for show)" : ""}.</p>
      <button class="btn ${armed ? "danger" : "pri"}" data-act="legend" data-id="${esc(sk)}">${armed ? `Yes, reset ${esc(sk)} to ${LEGEND.START}` : " Make Legendary"}</button>${armed ? ` <button class="btn" data-act="legendno">Not now</button>` : ""}</div>`;
  }
  /* a clear view of where your levels stand (top of the Character screen) */
  function progressPanel(inner = false) {
    if (typeof LEGEND === "undefined") return "";
    const p = LEGEND.progress(S);
    const near = p.closest.map((r) => `<button class="item prog-row" data-act="skinfo" data-id="${esc(r.sk)}">${UIART.skill(r.sk, 24)}<div class="t">${esc(r.sk)} ${r.lvl} → ${r.lvl + 1}<span><span class="bar"><i style="width:${r.pct}%;background:var(--frost)"></i></span>${r.pct}% there</span></div></button>`).join("");
    const ready = p.ready.length ? `<p class="sub leg-ready"> Ready to make Legendary: ${p.ready.map((r) => `<button class="linkbtn" data-act="skinfo" data-id="${esc(r.sk)}">${esc(r.sk)}</button>`).join(", ")}</p>` : "";
    const body = `<p class="sub">Level ${p.level} · ${p.charPct}% to level ${p.level + 1}. Every skill point you gain moves this bar (higher skills move it more), so every skill counts.</p>
      <div class="bar"><i style="width:${p.charPct}%;background:var(--gold)"></i></div>
      <p class="sub" style="margin-top:8px">Perk points to spend: <b>${PERKS.pointsLeft(S)}</b>${p.stars ? ` · Legendary stars: <b class="leg-stars">${p.stars}★</b>` : ""}</p>
      <p class="sub">Foes match your <b>fighting level ${p.fightLevel}</b>${p.fightLevel < p.level ? ` (lower than your level ${p.level}: crafting, trading and sneaking don't make the road harder)` : ""}. It follows your best weapon or spell skill and your best armor or defence skill, so better gear and skills always win you fights.</p>
      ${near ? `<h4 style="margin:10px 0 4px">Closest to going up</h4><div class="list">${near}</div>` : ""}${ready}`;
    return inner ? body : `<div class="panel prog-panel"><h2>Progress</h2>${body}</div>`;
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
      if (typeof ITEMCMP !== "undefined") ITEMCMP.bind(el, { preview: skyPreview });   // [itemdetail] PC: hover fills the side panel
      el.addEventListener("input", (e) => { if (e.target.id !== "skysearch") return; sky.q = e.target.value; if (sky.q && sky.cat === "gear") sky.cat = "all"; const pos = e.target.selectionStart; renderMenu(); const q = $("#skysearch"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } });
    }
    const cats = sky.page === "items" ? ITEM_CATS : sky.page === "magic" ? MAGIC_CATS : SKILL_CATS;
    let head = "", list = "", detail = "";
    if (sky.page === "items" && sky.cat === "gear") {
      list = `<div class="sky-doll">${dollScreen()}${typeof AMMO !== "undefined" && AMMO.status(S) && !AMMO.status(S).best ? ammoNote() : ""}<p class="sub dhint">Tap a slot to change what you wear.</p></div>`;
    } else if (sky.page === "items") {
      const rows = itemRows(); const sel = rows.find((r) => r.id === sky.sel) || (sky.sel == null && sky.hov != null ? rows.find((r) => String(r.id) === String(sky.hov)) : null) || null;   // [itemdetail] PC: the row under the mouse until one is pinned
      const M2 = typeof MENUS2 !== "undefined", sk2 = sky.sort === "dmg" || sky.sort === "arm" ? "stat" : sky.sort;
      const arrow = (k) => sk2 === k && (M2 || !S.invSort) ? ((sky.dir || 1) > 0 ? " ▾" : " ▴") : "";
      head = `${M2 ? MENUS2.itemSortBar(sky) : typeof INVQOL !== "undefined" ? INVQOL.sortHTML(S) : ""}<div class="sky-head sky-cols"><button data-act="skysort" data-id="name">Name${arrow("name")}</button><button data-act="skysort" data-id="${sky.cat === "apparel" ? "arm" : sky.cat === "weapons" ? "dmg" : "stat"}">${{ weapons: "Damage", apparel: "Armor", potions: "Effect", food: "Effect" }[sky.cat] || "Stat"}${arrow("stat")}</button><button data-act="skysort" data-id="weight">Wt${arrow("weight")}</button><button data-act="skysort" data-id="value">Value${arrow("value")}</button></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols ${r.id === sky.sel ? "sel" : ""} ${r.eq ? "eq" : ""}" data-act="skysel" data-id="${r.id}"><span class="nm q-${typeof CC !== "undefined" ? CC.tier(r.r.item, r.r) : "common"}${r.r.stolen ? " is-stolen" : ""}">${r.eq ? '<b class="eqm" title="Equipped" aria-label="Equipped">◆</b>' : ""}${ICONART.item(r.r.item, 24, r.r)}${r.eq ? "" : iqB(r.r.item, r.r)}${esc(r.name)}${r.r.qty > 1 ? ` <i>(${r.r.qty})</i>` : ""}${r.it.enchant || r.it.aenchant ? ' <i class="ench">✦</i>' : ""}${typeof CHARGE !== "undefined" ? CHARGE.tag(r.r.item, r.r, S) : ""}${r.r.stolen ? ' <i class="stolen">\uE15E</i>' : ""}</span><span class="num">${r.stat ?? "–"}</span><span class="num">${r.weight}</span><span class="num">${r.value}</span></button>`).join("") || `<p class="sub sky-empty">${sky.q ? `Nothing called “${esc(sky.q)}” here. Try “All”, or part of the name.` : "Nothing here. Buy things in town or loot them on the road."}</p>`;
      detail = sel ? itemDetail(sel) : "";
    } else if (sky.page === "magic") {
      const rows = magicRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      const tiers = ["all", "Novice", "Apprentice", "Adept", "Expert", "Master"];
      head = `<div class="sb-tiers">${tiers.map((t) => `<button class="sb-tier ${(sky.tier || "all") === t ? "on" : ""} tier-${t.toLowerCase()}" data-act="skytier" data-id="${t}">${t === "all" ? "All tiers" : t}</button>`).join("")}</div>${typeof MENUS2 !== "undefined" ? MENUS2.magicSortBar(sky) : `<div class="sky-head sky-cols2"><button data-act="skymsort" data-id="name">Name${sky.msort !== "cost" ? " ▾" : ""}</button><button data-act="skymsort" data-id="cost">Cost${sky.msort === "cost" ? " ▾" : ""}</button></div>`}`;
      list = rows.map((r) => `<button class="sky-row sky-cols2 ${r.id === sky.sel ? "sel" : ""} ${r.school ? ` sch-${r.school.toLowerCase()}` : ""}${r.el ? ` el-${r.el}` : ""}${r.support ? " sb-sup" : ""}" data-act="skysel" data-id="${esc(r.id)}"><span class="nm sk-nm ${typeof CC !== "undefined" ? `sch-${CC.school(r.id)} el-${CC.element(r.id) || "none"}` : ""}">${magicIcon(r.id, 26)}<span>${esc(r.name)}<small>${esc(r.sub)}</small></span></span><span class="num cost-mag">${r.cost ?? ""}</span></button>`).join("") || '<p class="sub sky-empty">Nothing here.</p>';
      detail = sel ? magicDetail(sel) : "";
    } else {
      const rows = skillRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      head = `<div class="sky-head sky-cols2"><button data-act="skysort" data-id="name">Skill</button><button data-act="skysort" data-id="lvl">Level</button></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols2 ${r.id === sky.sel ? "sel" : ""}" data-act="skysel" data-id="${esc(r.id)}"><span class="nm cat-${typeof CC !== "undefined" ? CC.skillCat(r.id) : ""}">${UIART.skill(r.id, 22)} ${esc(r.name)}<span class="bar"><i style="width:${r.prog}%;background:var(--frost)"></i></span></span><span class="num">${typeof LEGEND !== "undefined" && LEGEND.stars(S, r.id) ? `<b class="leg-stars">${LEGEND.stars(S, r.id)}★</b> ` : ""}${r.lvl}${r.bst.any ? '<span class="boost">▲</span>' : ""}</span></button>`).join("");
      detail = sel ? `<div class="sky-detail"><div class="sky-ico">${UIART.skill(sel.id, 56)}</div><h3 class="cat-${typeof CC !== "undefined" ? CC.skillCat(sel.id) : ""}">${esc(sel.name)} ${sel.lvl}</h3>${sel.bst.any ? `<p class="sub boost-t">${esc(sel.bst.text)}</p>` : ""}<p class="sub">${S.skills[sel.id].lvl >= 100 ? "At 100: ready to be made Legendary." : `${sel.prog}% of the way to ${sel.lvl + 1}.`} ${sel.perks ? `${sel.perks} perk${sel.perks > 1 ? "s" : ""} taken.` : ""} Perk points to spend: ${PERKS.pointsLeft(S)}.</p>${skillInfoHTML(sel.id)}
        <div class="sky-acts">${PERKS.TREES[sel.id] ? `<button class="btn pri" data-act="skyperks" data-id="${esc(sel.id)}">Perk tree</button>` : ""}</div></div>` : "";
      if (S.pendingLevels > 0 && typeof LEVELUP !== "undefined") detail = `<div class="sky-detail">${LEVELUP.promptHTML(S)}</div>` + detail;
      else if (S.pendingLevels > 0) detail = `<div class="sky-detail"><h3>Level up</h3><p class="sub">Choose what grows (+10), like Skyrim.</p><div class="sky-acts"><button class="btn" data-act="lvl" data-a="health">Health</button><button class="btn" data-act="lvl" data-a="magicka">Magicka</button><button class="btn" data-act="lvl" data-a="stamina">Stamina</button></div></div>` + detail;
    }
    const M2c = typeof MENUS2 !== "undefined", cnt = M2c && sky.page === "items" ? MENUS2.counts(S.inv, D.ITEMS, catOf) : null;   // menus2.js: counts on the category column
    const f = new G.Fight(S, { name: "-", health: 1, damage: 0, tags: [] });
    const armor = Math.round(f.armorRating().rating);
    let dmg = 0; for (let i = 0; i < 8; i++) dmg += f.weaponDamage(); dmg = Math.round(dmg / 8);
    const hp = G.curHealth(S), mh = G.maxHealth(S);
    const mtRestore = typeof MENUTOP !== "undefined" ? MENUTOP.keepList(el, sky) : null;   // menutop.js: same list keeps its place, a new one starts at the top
    el.innerHTML = `<div class="sky-in">
      <div class="sky-top"><button class="iconbtn" data-act="skyclose" aria-label="Close menu">✕</button>
        <div class="sky-pages">${[["items", "Items"], ["magic", "Magic"], ["skills", "Skills"]].map(([p, l]) => `<button class="sky-page ${p === sky.page ? "on" : ""}" data-act="skytab" data-id="${p}">${l}</button>`).join("")}</div><button class="uxi sky-i" data-act="uxhelp" data-id="pack" aria-label="What is this screen?" aria-expanded="${uxHelpOpen === "pack"}">ⓘ</button></div>
      ${uxHelpOpen === "pack" ? `<div class="uxpop" role="note"><p>${sky.page === "items" ? SCREEN_HELP.pack[2] : sky.page === "magic" ? "Your spells, powers and shouts. Tap one to read it or use it." : "Your skills. They grow as you use them; tap one to see its perk tree and how to raise it."}</p>${typeof CC !== "undefined" ? CC.legend() : ""}<button class="btn sm" data-act="uxhelp" data-id="pack">Got it</button></div>` : ""}
      <div class="sky-cats" role="tablist">${cats.map(([k, l]) => `<button class="sky-cat ${k === sky.cat ? "on" : ""}" data-act="skycat" data-id="${k}" role="tab" aria-selected="${k === sky.cat}" aria-label="${l}">${svgI(k)}<span>${l}</span>${M2c && cnt ? MENUS2.badge(k === "gear" ? 0 : cnt[k]) : ""}</button>`).join("")}</div>
      <div class="sky-mid">${sky.page !== "skills" && !(sky.page === "items" && sky.cat === "gear") ? `<input id="skysearch" class="uxsearch sky-search" type="search" placeholder="${sky.page === "magic" ? " Find a spell by name" : " Find an item by name"}" value="${esc(sky.q || "")}" autocomplete="off" aria-label="${sky.page === "magic" ? "Find a spell" : "Find an item"}">` : ""}
      ${head}<div class="sky-list">${list}</div></div>${detail || (M2c && !(sky.page === "items" && sky.cat === "gear") ? MENUS2.pickHint(sky.page) : "")}
      <div class="sky-foot">${sky.page === "magic" ? `<span>Magicka <b class="num">${G.maxMagicka(S)}</b></span><span title="Magicka that comes back each fight round">Regen a round <b class="num">+${Math.round((f.regenMp || 0) * 3.2)}</b></span>` : `<span>Armor <b class="num">${armor}</b></span><span>Damage <b class="num">${dmg}</b></span><span>Weight <b class="num">${G.carried(S).toFixed(0)}/${G.capacity(S)}</b></span>`}<span class="gold">${S.gold} gold</span></div>
      <div class="sky-vitals"><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--hp)"></i></div><div class="bar"><i style="width:100%;background:var(--mp)"></i></div><div class="bar"><i style="width:100%;background:var(--sp)"></i></div></div>
    </div>`;
    if (mtRestore) mtRestore();
    if (typeof FAVWHEEL !== "undefined") FAVWHEEL.afterMenu(el, S, sky);   // ★ Favourite in the details
    if (typeof MOTION !== "undefined") MOTION.menu(el, sky.page, sky.cat);
    if (typeof MENUS !== "undefined") MENUS.skyOn(sky.page, el);
  }

  // ------------------------------------------------------------ dragon attacks (world events)
  // ---- raid / arena / clan art helpers (raidart.js)
  const raPortrait = (id, size) => { if (typeof HEROART === "undefined") return ""; const c = id === S.id ? S : cardOf(id) || ladderDocs.find((d) => d.id === id); return c ? (typeof AVATAR !== "undefined" ? AVATAR.portrait(c, size) : HEROART.portrait(c, size)) : ""; };
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
    const dk = WEVENTS.kindOf(r), dn = dk.name.toLowerCase(), ph = WEVENTS.phase(r);
    if (raidSeen !== r.id) {
      raidSeen = r.id; SOUND.fx("dragon"); toast(` A ${dn} is circling ${r.town}!`);
      if (!news.some((n) => n.text.includes(r.id))) postNews(` A ${dn} is circling ${r.town}! It attacks in a few minutes. Every warrior is needed. (${r.id})`);
    }
    const here = S.location === r.town;
    // being in the town while it circles (or when it attacks) counts you in: the dragon gets tougher for everyone
    if (here && raidJoined !== r.id && WEVENTS.join(S, r)) { raidJoined = r.id; Store.put("raids", `${r.id}-${S.id}`, { raid: r.id, uid: S.id, name: S.name, dmg: S.raid.dmg, lv: S.level, t: G.now() }); persist(true); }
    const tl = WEVENTS.tally(r, raidDocs, S), done = tl.total >= tl.need;
    const secs = Math.max(0, Math.ceil(((ph === "gather" ? r.fightAt : r.end) - G.now()))), clock = ph === "gather" ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : `${Math.ceil(secs / 60)} min`;
    const msg = WEVENTS.claim(S, r, raidDocs);
    if (msg) { persist(true); showMessage("The dragon falls", msg); }
    // the timer ran out: it attacks everyone who's in the town
    if (ph === "fight" && here && !done && raidAuto !== r.id && raidJoined === r.id && !$("#modal") && !(typeof TB !== "undefined" && TB.open)) { raidAuto = r.id; toast(` The ${dn} dives at ${r.town}!`); setTimeout(raidFight, 50); }
    const title = done ? `The ${esc(dn)} over ${esc(r.town)} is dead` : ph === "gather" ? `A ${esc(dn)} is circling ${esc(r.town)}` : `A ${esc(dn)} is attacking ${esc(r.town)}`;
    const sub = done ? "Everyone who fought shares the soul and the spoils."
      : ph === "gather" ? `It attacks in ${clock}. ${tl.people ? `${tl.people} ${tl.people === 1 ? "hero has" : "heroes have"} gathered` : "No one has gathered yet"}. Be in ${esc(r.town)} when the timer runs out to fight it together. The more people come, the tougher it gets.`
      : `${tl.total}/${tl.need} damage dealt${tl.people ? ` by ${tl.people} ${tl.people === 1 ? "fighter" : "fighters"}` : ""}. Everyone who hurts it gets its soul, 300 gold, dragon bone and scales. It flies at first (melee only grazes it) and lands when badly hurt.`;
    const btn = done ? "" : !here ? `<button class="btn" data-act="go" data-place="${esc(r.town)}" style="width:100%">Travel to ${esc(r.town)}</button>`
      : ph === "gather" ? `<button class="btn" disabled style="width:100%"> Waiting for the ${esc(dn)}... ${clock}</button>` : `<button class="btn danger" data-act="raidfight" style="width:100%"> Fight the ${esc(dn)}</button>`;
    /* the painted dragon card (eventcards.js): title under the painting, a severity diamond beside it; the old drawing until it loads */
    const card = typeof EVCARDS !== "undefined" ? EVCARDS.html("raid", { title: ` ${title}`, sev: done ? "calm" : ph === "gather" ? "high" : "dire", right: done ? "" : `<span class="num sub">${clock}</span>` }) : "";
    el.innerHTML = `<div class="trip enc${card ? " evc-box" : ""}" style="margin-top:10px">${card || `${typeof EVENTART !== "undefined" ? EVENTART.raid(r.town, done) : ""}<div class="row"><b> ${title}</b><span class="num sub">${done ? "" : clock}</span></div>`}
      ${typeof RAIDART !== "undefined" ? RAIDART.raidHealth(tl, raidDocs, r, S, raPortrait) : `<div class="bar"><i style="width:${pct(tl.total, tl.need)}%;background:var(--ember)"></i></div>`}
      <div class="sub">${sub}</div>${btn}</div>`;
  }
  function raidFight() {
    const r = WEVENTS.activeRaid(); if (!r) return toast("The dragon is gone.");
    tbCall(() => WEVENTS.fight(S, r, raidDocs), (out) => raidDone(r, out));
  }
  function raidDone(r, out) {
    if (!out.fight) return toast(out.text);
    Store.put("raids", `${r.id}-${S.id}`, { raid: r.id, uid: S.id, name: S.name, dmg: S.raid.dmg, lv: S.level, t: G.now() });
    if (out.bag) Store.addBag(out.bag);
    if (out.slain) postNews(` ${S.name} struck the killing blow on the dragon over ${r.town}!`);
    warPoint("raid", G.holdAt(WORLD.places[r.town]));
    persist(true); renderPanel(true); renderRaid();
    showFightResult({ ...out, text: out.text, loot: [], gold: 0 });
  }

  // ------------------------------------------------------------ quests
  function questPos() {
    const act = QUESTS.active(S), mapOf = (x) => { const n = QUESTS.target(x.st); return n && WORLD.places[n] && WORLD.same(WORLD.places[n], [S.x, S.y]); };
    const tq = QUESTS.tracked(S), a = (tq && mapOf(tq) ? tq : null) || act.find(mapOf) || act[0]; if (!a) return null;
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
    return `<div class="panel"><h2>Quests</h2><div class="list">${rows || '<p class="sub">No active quests. Ask around: quest givers are listed below under Guilds, and the inn (Area tab) sells rumours.</p>'}</div>
      ${work ? `<h3 style="margin-top:12px">Guild work</h3><div class="list">${work}</div>` : ""}
      ${avail ? `<h3 style="margin-top:12px">Guilds</h3><div class="list">${avail}</div>` : ""}
      ${done.length ? `<p class="sub" style="margin-top:8px">Completed: ${done.map(esc).join(", ")}</p>` : ""}
      <p class="sub" style="margin-top:6px">The gold diamond on the map marks where your current quest leads.</p></div>`;
  }
  function guildWork(id) { tbCall(() => GUILDS.work(S, id), (r) => guildDone(id, r)); }
  function guildDone(id, r) {
    if (r.bag) Store.addBag(r.bag);
    persist(true); renderPanel(true);
    const text = [r.text, ...(r.msgs || [])].join(" ");
    if (r.fight) return showFightResult({ ...r, text, loot: [], gold: 0 });
    SOUND.fx(/off|run/.test(r.text) ? "click" : "coin");
    showMessage(id === "thieves" ? "Thieves Guild" : "Dark Brotherhood", text);
  }
  function questTalk(id) { tbCall(() => QUESTS.talk(S, id), (r) => questDone(id, r)); }
  function questDone(id, r) {
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
  /* [qa-core] tutorial lines are translated whole (i18n_qacore.js): the on-screen swap can't reach sentences split by <b> */
  const LT = (en, v) => typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : en.replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? String(v[k]) : m));
  if (typeof I18N !== "undefined" && I18N.add && typeof I18N_QACORE !== "undefined") I18N.add(I18N_QACORE.tpl);
  const TUT = [
    null,
    { title: "Your first trip", text: () => ppUI && party && !ppUI.canDecide() ? LT("Welcome to Skyrim, {name}. You're in a party: the leader picks where to go and you travel with them. Watch the map; the next step starts when you set off.", { name: esc(S.name) }) : LT("Welcome to Skyrim, {name}. Everything happens in real time. Tap <b>Whiterun</b> on the map and press <b>Travel</b>, or press <b>Go</b> next to it in the list below.", { name: esc(S.name) }) + (party ? " " + LT("Your party comes along.") : ""), done: () => !!S.trip || S.location === "Whiterun" },
    { title: "On the road", text: () => typeof TB !== "undefined" && TB.enabled() ? LT("You're walking. Trips keep going even when the app is closed, and something may happen by the road: if it's a fight, you play it turn by turn (or press Auto). You can ride a horse later, or take a carriage between cities.") : LT("You're walking. Trips keep going even when the app is closed, and something may happen by the road. You can ride a horse later, or take a carriage between cities."), done: () => !S.trip },
    { title: "You've arrived", text: () => S.location && TOWNS.isTown(S.location) ? LT("Open the <b>Area</b> tab. In towns and cities it has shops, the inn, trainers, the forge, jobs and more.") : LT("Open the <b>Area</b> tab. This spot is out in the wilds, so it shows what you can do here."), done: () => tab === "town" },   // [qa-core] the tab is called Area now
    { title: "Quests", text: () => LT("Now open the <b>Journal</b>. Your quests are there, and the gold diamond on the map shows where to go next. Chat and other players are under <b>Social</b>."), done: () => tab === "log" },
  ];
  const TAB_TIPS = {
    map: "Start with the “What to do next” card. Press Go to travel; tap any place on the map to see how far it is.",
    hero: "Your level, skills and perks. A dot on this tab means you can level up or spend a perk point.",
    pack: "Everything you carry. Tap an item to wear or use it; search by name at the top of the list.",
    town: "Places in town are grouped: Shops, Services, Guilds & jobs. Each town has different ones; shops close at night.",
    log: "Only your quests live here: Active, Misc and Completed. ☆ Track the one you're on and the compass and map follow it.",
  };

  /* [stations] a place's own page (forge, inn, a shop...) opens on the work: no guide card or tab tip on top of it */
  const atStation = () => tab === "town" && !!townShop && townShopAt === S.location && typeof AREAUI !== "undefined";
  const guideOffer = () => !S.guideOffered && S.level < 10 && (tab === "map" || (tab === "town" && !atStation())) && (!S.tut || S.tut.off || S.tut.step === 0)
    ? `<div class="tut"><div class="tut-h"><b> New to the game?</b></div><p>The guide walks you through your first hour: trading, fighting, dungeons, smithing, friends and more.</p><div style="display:flex;gap:8px"><button class="btn sm pri" data-act="guide">Open the guide</button><button class="btn sm" data-act="guideno">Not now</button></div></div>` : "";
  function tutTip() {
    const t = S.tut; if (!t || t.off) return guideOffer();
    if (t.step > 0 && t.step < TUT.length) {
      while (t.step < TUT.length && TUT[t.step].done()) t.step++;
      if (t.step >= TUT.length) { t.step = 0; S.gold += 100; Store.save(S); setTimeout(() => { SOUND.fx("quest"); toast("Tutorial done. Riverwood's steward sends you 100 gold for the road."); }, 300); }
      else { const st = TUT[t.step]; return `<div class="tut"><div class="tut-h"><b>${esc(LT(st.title))}</b><span class="sub">${esc(LT("{n} of {m}", { n: t.step, m: TUT.length - 1 }))}</span></div><p>${st.text()}</p><button class="linkbtn" data-act="tutskip">${esc(LT("Skip the tutorial"))}</button></div>`; }
    }
    if (guideOffer()) return guideOffer();
    if (TAB_TIPS[tab] && !t.seen?.[tab] && !atStation()) return `<div class="tut"><p> ${TAB_TIPS[tab]}</p><button class="btn sm" data-act="tutseen">Got it</button></div>`;
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
    const HU = typeof HOLDUI !== "undefined" ? HOLDUI.panel(S) : "";   // player-run holds (holdui.js): seats, Jarls and raids; this week's war points stay below
    const w = WARS.week(), st = WARS.standings(w, S), rul = WARS.rulers(S), mine = myClan();
    const left = BOUNTY.weekEnds(w) - Date.now(), days = Math.floor(left / 864e5), hrs = Math.floor((left % 864e5) / 36e5);
    return HU + `<div class="panel"><h2>${HU ? "War points this week" : "Holds"}</h2><p class="sub">Clans fight for the nine holds each week. Win fights, clear dungeons and fight dragons inside a hold to earn it points (Arena wins count for Eastmarch). Whoever leads when the week ends rules it all next week, and their members shop 10% cheaper there. ${days}d ${hrs}h left.</p>
      ${!HU && typeof RAIDART !== "undefined" ? RAIDART.holdsMap(rul) : ""}
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
    setTimeout(() => { SOUND.fx("quest"); toast(`${ev.icon} ${ev.name} has begun! See Map → World news.`); }, 2500);
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
    const row = (d, btn) => `<div class="item${btn === "buy" ? tiCls(d.row.item) : ""}"><span class="mk-ico"${typeof RTIP !== "undefined" ? RTIP.attr(d.row.item, d.row.qty || 1) : ""}>${ICONART.item(d.row.item, 34, d.row)}</span><div class="t">${esc(MARKET.itemName(d.row))}${d.row.qty > 1 ? ` ×${d.row.qty}` : ""}${btn === "buy" ? iqB(d.row.item, d.row) : ""}<span>${btn === "buy" ? `${d.hall ? ` ${esc(d.hallName || d.sellerName + "'s hall")}` : `${esc(d.sellerName)}'s stall`} · ${esc(G.itemStats(d.row.item))}` : d.hall ? "on your hall counter" : "on your stall"}</span></div><span class="num gold">${d.price}</span>${btn === "buy" ? `<button class="btn sm pri" data-act="mbuy" data-id="${esc(d.id)}" ${S.gold >= d.price ? "" : "disabled"}>Buy</button>` : `<button class="btn sm" data-act="mpull" data-id="${esc(d.id)}">Take back</button>`}${btn === "buy" ? tiBox(d.row.item) : ""}</div>`;
    let h = `<h3>For sale here</h3>${forSale.length ? forSale.map((d) => row(d, "buy")).join("") : `<p class="sub">No player stalls in ${esc(l)} right now.</p>`}`;
    if (!house) return h + `<p class="sub" style="margin-top:10px">Own a house in ${esc(l)}, or a hall here with a shop counter, to run your own stall.</p>`;
    const pack = G.handable(S).filter((r) => !r.stolen && D.ITEMS[r.item]).slice(0, 40);   // worn gear never shows here
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
        return `<div class="item ${L ? "on" : ""}"><div class="t">${L ? "" : "○"} ${esc(nm)}${L ? ` · level ${L}` : ""}<span>${esc(desc)}${next <= 2 ? `<br>${L ? "Improve" : "Build"}: ${esc(hallCostText(id, next, clan))}` : ""}</span></div>${next <= 2 ? `<button class="btn sm ${e ? "" : "pri"}" data-act="hbuild" data-id="${id}" data-c="${c}" ${e || !here || !own ? "disabled" : ""} title="${esc(e || "")}">${L ? "Improve" : "Build"}</button>` : ""}</div>`;
      }).join("") + (clan ? `<p class="sub">Guild halls pay for everything from the guild funds (materials are bought in gold). Only the founder builds; any member can give gold.</p>` : `<p class="sub">Materials come from your pack: ingots from the forge, leather, firewood. Mines and blacksmiths have them.</p>`);
      b += `<div class="item"><div class="t">The hearth<span>Rest here for free. Comfort ${HALLS.comfort(h)}/${HALLS.COSY}: ${HALLS.comfort(h) >= HALLS.COSY ? "Well Rested (+10% skills)" : "Rested (+5%); decorate for Well Rested"}</span></div><button class="btn sm pri" data-act="hrest" data-c="${c}" ${here ? "" : "disabled"}>Rest</button></div>`;
      if (HALLS.lvl(h, "shrine")) b += `<div class="item"><div class="t">The shrine<span>Once a day: +${HALLS.lvl(h, "shrine") >= 2 ? 50 : 25} health for a day, diseases cured</span></div><button class="btn sm" data-act="hpray" data-c="${c}" ${here ? "" : "disabled"}>Pray</button></div>`;
      if (HALLS.lvl(h, "forge")) b += `<div class="item"><div class="t">The forge<span>Smithing improves ${HALLS.lvl(h, "forge") * 10}% faster here</span></div><button class="btn sm" data-act="shop" data-id="forge" ${here ? "" : "disabled"}>Use</button></div>`;
    } else if (hallTab === "decor") {
      b = `<p class="sub" style="margin-top:0">${(h.decor || []).length}/${HALLS.decorCap(h)} spaces · each room built gives one more.</p>` + Object.entries(HALLS.DECOR).map(([id, [nm, price, cf]]) => {
        const has = (h.decor || []).includes(id), e = HALLS.canPay(purse, price);
        return `<div class="item ${has ? "on" : ""}"><div class="t">${has ? " " : ""}${esc(nm)}<span>+${cf} comfort</span></div>${has ? (own ? `<button class="btn sm" data-act="hundecor" data-id="${id}" data-c="${c}">Take down</button>` : "") : `<span class="num gold">${price}</span><button class="btn sm" data-act="hdecor" data-id="${id}" data-c="${c}" ${e || !here || !own || (h.decor || []).length >= HALLS.decorCap(h) ? "disabled" : ""}>Put up</button>`}</div>`;
      }).join("");
    } else if (hallTab === "staff") {
      b = `<p class="sub" style="margin-top:0">Wages come out of the ${clan ? "guild funds" : "coffer"} once an in-game day (every 2 real hours): ${HALLS.wages(h)} gold a day now. Unpaid staff leave.</p>` + (clan ? HALLS.CLAN_STAFF : Object.keys(HALLS.STAFF)).map((id) => {
        const [nm, fee, wage, need, desc] = HALLS.STAFF[id], has = (h.staff || {})[id], e = HALLS.canPay(purse, fee) || (need && !HALLS.lvl(h, need) ? `Build the ${HALLS.ROOMS[need][0].toLowerCase()} first.` : null);
        return `<div class="item ${has ? "on" : ""}">${typeof HOMEART !== "undefined" ? "" : ""}<div class="t">${has ? " " : ""}${esc(nm)}<span>${esc(desc)} · ${wage} gold a day</span></div>${has ? (own ? `<button class="btn sm" data-act="hfire" data-id="${id}" data-c="${c}">Let go</button>` : "") : `<span class="num gold">${fee}</span><button class="btn sm" data-act="hhire" data-id="${id}" data-c="${c}" ${e || !here || !own ? "disabled" : ""} title="${esc(e || "")}">Hire</button>`}</div>`;
      }).join("");
    } else if (hallTab === "store") {
      const pack = G.handable(S).filter((r) => D.ITEMS[r.item] && !(clan && (r.stolen || D.ITEMS[r.item].noTrade)));
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
    return `${typeof HOMEART !== "undefined" ? HOMEART.guild(h) : ""}<div class="card"><h3>${clan ? ` ${esc(h.name)} [${esc(h.tag || "")}]` : ` ${esc(h.name)}`}</h3><p class="sub" style="margin:0">${esc(h.town)} · ${HALLS.roomCount(h)} room${HALLS.roomCount(h) === 1 ? "" : "s"} · ${clan ? `funds ${(h.funds || 0).toLocaleString()}` : `coffer ${(h.coffer || 0).toLocaleString()}`} gold${here ? "" : ` · you're away (${esc(S.location || "on the road")})`}</p></div>
      <div class="chips hallnav">${tabs.map(([k, n]) => `<button class="chip ${k === hallTab ? "on" : ""}" data-act="htab" data-id="${k}">${n}</button>`).join("")}</div><div class="list">${b}</div>`;
  }
  function hallsHTML(l) {
    if (hallView) {
      const d = hallDocs.find((x) => x.id === hallView);
      if (d) return `<button class="btn sm" data-act="hback">← Back</button>${typeof HOMEART !== "undefined" ? HOMEART.guild(d) : ""}<div class="card"><h3>${d.clan ? "" : ""} ${esc(d.name)}</h3><p class="sub" style="margin:0">${d.clan ? `Guild hall of ${esc(d.clanName || "a clan")}` : `${esc(d.ownerName)}'s hall · level ${d.level || 1}`}</p></div>
        <div class="list">${Object.entries(d.rooms || {}).filter(([, v]) => v).map(([k, v]) => `<div class="item"><div class="t">${esc(HALLS.ROOMS[k]?.[0] || k)}${v > 1 ? " · level 2" : ""}</div></div>`).join("") || `<p class="sub">Bare walls and a hearth, for now.</p>`}
        ${(d.trophies || []).length ? `<h3 style="margin-top:10px">On the trophy wall</h3><p class="sub">${d.trophies.map((t) => esc(D.ITEMS[typeof t === "string" ? t : t.item]?.name || "")).filter(Boolean).join(", ")}</p>` : ""}
        ${d.shop ? `<button class="btn pri" data-act="shop" data-id="market" style="width:100%;margin-top:6px">See ${esc(d.ownerName)}'s shop in the Market stalls</button>` : ""}</div>`;
      hallView = null;
    }
    let h = "";
    const mine = S.hall, c = myClan(), ch = clanHall();
    if (mine && mine.town === l) h += hallManageHTML(mine, false);
    else if (mine) h += `<div class="item"><div class="t"> ${esc(mine.name)}<span>Your hall is in ${esc(mine.town)} · coffer ${(mine.coffer || 0).toLocaleString()} gold</span></div></div>`;
    else if (HALLS.plotHere(l)) h += `<div class="card"><h3>Buy a hall plot in ${esc(l)}</h3><p class="sub">Your own hall: build a forge, a shrine, a trophy room, storage and a shop counter; decorate it; hire a shopkeeper, a steward and a guard.</p>
      <div class="chatrow"><input id="hname" maxlength="28" placeholder="${esc(S.name)}'s Hall" autocomplete="off" aria-label="Hall name"><button class="btn pri" data-act="hplot" ${S.gold >= HALLS.plotPrice(l) ? "" : "disabled"}>Buy · ${HALLS.plotPrice(l).toLocaleString()}</button></div></div>`;
    if (c && ch && ch.town === l) h += `<h3 style="margin-top:14px">Your guild hall</h3>` + hallManageHTML(ch, true);
    else if (c && ch) h += `<div class="item"><div class="t"> ${esc(ch.name)}<span>Your clan's hall is in ${esc(ch.town)}</span></div></div>`;
    else if (c && c.founder === S.id && HALLS.plotHere(l)) h += `<div class="card"><h3>Raise a guild hall for ${esc(c.name)}</h3><p class="sub">One hall for the whole clan: shared storage, a forge and a shrine for every member. Members give gold to build it.</p>
      <div class="chatrow"><input id="chname" maxlength="28" placeholder="Hall of ${esc(c.name)}" autocomplete="off" aria-label="Guild hall name"><button class="btn pri" data-act="hclanplot" ${S.gold >= HALLS.plotPrice(l, true) ? "" : "disabled"}>Buy · ${HALLS.plotPrice(l, true).toLocaleString()}</button></div></div>`;
    else if (c && !ch) h += `<p class="sub" style="margin-top:10px">Your clan has no guild hall yet. The founder can buy one in a hold capital.</p>`;
    const others = hallDocs.filter((d) => d.town === l && d.id !== S.id && !(ch && d.id === ch.id));
    h += `<h3 style="margin-top:14px">Other halls in ${esc(l)}</h3>${others.length ? others.map((d) => `<div class="item"><div class="t">${d.clan ? "" : ""} ${esc(d.name)}<span>${d.clan ? `Guild hall · ${esc(d.clanName || "")}` : `${esc(d.ownerName)} · ${HALLS.roomCount(d)} rooms${d.shop ? " · has a shop" : ""}`}</span></div><button class="btn sm" data-act="hvisit" data-id="${esc(d.id)}">Visit</button></div>`).join("") : `<p class="sub">None yet${Store.online ? "" : " (or you're playing offline)"}.</p>`}`;
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
    if (CURSE.offered(S) && !S.wolfOfferSeen) { S.wolfOfferSeen = true; persist(); toast(" The Circle of the Companions wants a word with you in Whiterun. See the Character tab."); }
  }
  function bloodPanel() {
    const t = G.now(), here = S.location;
    const bpx = (k) => (typeof BEASTPATH !== "undefined" ? BEASTPATH.panelExtra(S, k) : "");   // forms, moves, hunger and townsfolk (beastpaths.js)
    const tree = (k) => typeof BEASTART !== "undefined" ? BEASTART.panel(S, k) : "";
    const cureQ = (id) => { const v = (S.quests || {})[id], d = QUESTS.L[id]; if (!d || !v || v.done) return ""; const st = d.stages[v.stage];
      return `<div class="item on"><div class="t"> ${esc(d.name)}: ${esc(st.title)}<span>${esc(st.text)}</span></div></div>`; };
    if (S.vampire) {
      const st = CURSE.stage(S), dd = CURSE.daysUnfed ? CURSE.daysUnfed(S) : CURSE.hoursUnfed(S) / 2, dtxt = dd < 1 ? `${Math.round(dd * 24)} in-game hours` : `${dd.toFixed(1)} in-game days`;
      return `<div class="panel" style="border-color:#7a1414"><h2> Vampire</h2><p class="sub">Hunger: stage ${st} of 4 (${dtxt} since you fed; one stage per day). The hungrier you are, the stronger your Destruction and Illusion and your night-time blows, the less frost hurts you, and the more fire burns. Poison barely touches you. By day the sun slows your healing outside. Feed at an inn (Area tab), or win a fight as a Vampire Lord.</p>
        <div class="item"><div class="t"> Vampire Lord<span>Once a day, from the Magic menu (Powers): for ${CURSE.LORD_TURNS || 12} turns you drain the foe's life every turn and take less damage. No potions while changed.</span></div><span class="num sub">${CURSE.lordReady(S) ? "Ready" : "Used today"}</span></div>
        ${bpx("lord")}${cureQ("cure_vamp")}${tree("lord")}</div>`;
    }
    if (S.moonblood && typeof BEASTPATH !== "undefined") return BEASTPATH.moonPanel(S);
    if (S.sanguinare) {
      const left = Math.max(0, CURSE.TURN_AFTER - (t - S.sanguinare.at)), h = Math.floor(left / 3600), m = Math.ceil((left % 3600) / 60);
      return `<div class="panel" style="border-color:#7a1414"><h2> Sanguinare Vampiris</h2><p class="sub">A vampire's disease. In about ${h ? `${h} h ` : ""}${m} min (${(left / CURSE.DAY).toFixed(1)} in-game days) you'll turn into a vampire. Drink a Potion of Cure Disease (general stores, court wizards) or pray at a roadside shrine to stop it, or let it happen.</p></div>`;
    }
    if (S.werewolf) return `<div class="panel" style="border-color:var(--gold)"><h2> Werewolf</h2><p class="sub">Beast Form, once a day, is in your Magic menu under Powers: for ${CURSE.BEAST_TURNS} turns you hit much harder, take less damage and heal a bit, but can't drink potions. Win a fight in Beast Form against a person and you feed: it heals you and grows your werewolf perks. Beds no longer make you Rested, and you can't catch diseases.</p>
      ${bpx("wolf")}${cureQ("cure_wolf")}${tree("wolf")}</div>`;
    if (CURSE.offered(S)) return `<div class="panel" style="border-color:var(--gold)"><h2> The Circle's offer</h2><p class="sub">The Companions' inner circle offers you their secret: the blood of the beast. Once a day you can turn into a werewolf in a fight, and feeding grows its own perk stars. Beds won't make you Rested any more. If you ever want it gone, Aela knows how: the Glenmoril witches' heads.</p>
      <div class="grid2"><button class="btn pri" data-act="wolfyes" ${here === "Whiterun" ? "" : "disabled"}>Accept${here === "Whiterun" ? "" : " (in Whiterun)"}</button><button class="btn" data-act="wolfno">No, thank you</button></div></div>`;
    return "";
  }


  // ------------------------------------------------------------ achievements
  let achOpen = false;
  function achPanel() {
    const all = ACH.progress(S), got = all.filter((a) => a.done);
    const list = achOpen ? all : [...got, ...all.filter((a) => !a.done).sort((a, b) => b.cur / b.goal - a.cur / a.goal).slice(0, 3)];
    return `<div class="panel"><h2>Achievements · ${got.length}/${all.length}</h2><div class="list">${list.map((a) => `<div class="item ${a.done ? "on" : ""}" style="flex-wrap:wrap;${a.done ? "" : "opacity:.85"}">${UIART.ach(a.id, 32, a.done)}<div class="t">${esc(a.name)}<span>${esc(a.what)}</span></div><span class="num ${a.done ? "gold" : "sub"}">${a.done ? "" : `${a.cur.toLocaleString()}/${a.goal.toLocaleString()}`}</span>
      ${a.done ? "" : `<div class="bar" style="width:100%;margin-top:4px"><i style="width:${(100 * a.cur) / a.goal}%;background:var(--frost)"></i></div>`}</div>`).join("")}</div>
      <button class="btn" data-act="achmore" style="width:100%;margin-top:8px">${achOpen ? "Show fewer" : `Show all ${all.length}`}</button></div>`;
  }
  function checkAch() {
    const fresh = ACH.check(S);
    if (!fresh.length) return;
    persist(true);
    if (typeof NOTIFY !== "undefined") NOTIFY.ach(fresh);   // [notify] ones earned together share one banner
    else fresh.forEach((a, i) => setTimeout(() => { SOUND.fx("levelup"); toast(` Achievement: ${a.icon} ${a.name}`); }, 1200 * i));
    for (const a of fresh) if (Store.online) postNews(` ${S.name} earned “${a.name}”.`);
  }

  // ------------------------------------------------------------ map pins
  const PIN_ICONS = ["", "", "", "", "", "", "", ""], PIN_MAX = 20;
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
    pinDraft = { x, y, icon: pinDraft?.icon || "" };
    openModal(`<h2>Drop a pin</h2><p class="sub" style="margin-top:0">${esc(G.holdAt([x, y]))} · about ${fmtMin(G.minutesTo(S, [x, y]))} away. Only you see your pins, unless you share one with your party.</p>
      <div class="chips">${PIN_ICONS.map((i) => `<button class="chip ${i === pinDraft.icon ? "on" : ""}" data-act="pinicon" data-id="${i}" aria-label="Icon ${PIN_ICONS.indexOf(i) + 1}">${i}</button>`).join("")}</div>
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
    S.pins.push({ id, x: Math.min(1, Math.max(0, +x)), y: Math.min(1, Math.max(0, +y)), label, icon: PIN_ICONS.includes(icon = typeof GI !== "undefined" ? GI.swap(icon) : icon) ? icon : "" });
    persist(); return id;
  }

  // ------------------------------------------------------------ fishing and cooking
  function cookList() {
    if (CQ) return CQ.cookList(S, COOK.canCook(S)) + `<p class="sub" style="margin-top:8px">General stores sell salt, vegetables and meat. Garlic and lavender grow in home gardens and are sold by alchemists.</p>`;
    return Object.entries(COOK.RECIPES).map(([id, [name, ings, , what]]) => {
      const miss = COOK.missing(S, id);
      return `<div class="item" style="flex-wrap:wrap"><div class="t">${esc(name)}<span>${esc(what)} · ${ings.map(([it, q]) => `${q > 1 ? q + " " : ""}${it === "fish" ? "any fish" : esc(D.ITEMS[it].name)}`).join(", ")}</span></div>
        <button class="btn sm ${miss.length ? "" : "pri"}" data-act="cook" data-id="${id}" ${miss.length || !COOK.canCook(S) ? "disabled" : ""}>Cook</button>${miss.length ? `<span class="sub" style="width:100%">Missing: ${esc(miss.join(", "))}</span>` : ""}</div>`;
    }).join("") + `<p class="sub" style="margin-top:8px">General stores sell salt, vegetables and meat. Garlic and lavender grow in home gardens and are sold by alchemists.</p>`;
  }
  function fishCard() {
    const c = FISHGAME.canFish(S, livePos()), caught = (S.stats || {}).fish || 0, rod = FISHGAME.rodOf(S);
    return `<div class="item"><div class="t">\uE146 Go fishing<span>${c.err ? esc(c.err) : `<b>${esc(rod.name)}</b> · You've caught ${caught} fish so far.`}</span></div><button class="btn sm pri" data-act="fishgo" ${c.err ? "disabled" : ""}>Cast</button></div>`;
  }
  /* hunting grounds (huntgame.js): stalk an animal, shoot it, skin it */
  function huntCard() {
    if (typeof HUNTGAME === "undefined") return "";
    const err = HUNTGAME.block(S), n = (S.stats || {}).hunted || 0;
    return `<div class="item"><div class="t">\uE10C Go hunting<span>${err ? esc(err) : `${HUNTGAME.groundLeft(S)} animals around here today · You've brought down ${n} so far.`}</span></div><button class="btn sm pri" data-act="huntgo" ${err ? "disabled" : ""}>Stalk</button></div>`;
  }
  function wildsFood() {
    if (S.trip?.status === "travel" || S.trip?.status === "encounter" || S.dungeon) return "";
    const lit = COOK.campLit(S), water = COOK.waterNear(livePos());
    return `<div class="panel"><h2>Camp</h2>
      ${lit ? `<p class="sub">Your fire crackles. ${Math.ceil((S.camp.until - G.now()) / 60)} minutes of warmth left.</p>${cookList()}` : `<div class="item"><div class="t">\uE104 Make a campfire<span>Uses 1 Firewood · lets you cook here for ${COOK.CAMP_MIN} minutes</span></div><button class="btn sm" data-act="camp">Light</button></div>`}
      ${water ? fishCard() : ""}${huntCard()}</div>`;
  }
  /* fishing.js: cast, wait for the bite, reel with the tension meter */
  function openFishing() {
    const err = FISHGAME.play(S, livePos(), { onCatch: () => persist(), onClose: () => { persist(true); renderPanel(true); } });
    if (err) toast(err);
  }
  /* huntgame.js: from a hunting ground, or from an animal met on the road (road = the encounter ends either way) */
  function openHunt(road = false) {
    const e = road ? S.trip?.encounter : null, id = road ? HUNTGAME.fromEncounter(e) : null;
    if (road && !id) return;
    if (road) closeModal();
    const err = HUNTGAME.play(S, { id, road, pos: livePos() }, (res) => {
      if (road) {
        if (!res) return openEncounter();   // lowered the bow before anything happened: back to the choice
        HUNTGAME.endRoad(S);
        ppUI?.leaderResolved(HUNTGAME.told(res, e.name));   // the party hears exactly what the leader got
        renderTrip();
      }
      persist(true); renderPanel(true);
    });
    if (err) { toast(err); if (road) openEncounter(); }
  }

  // ------------------------------------------------------------ visiting homes and gifts
  let homeDocs = [], giftDocs = [], seenGifts = new Set(), lastHomeJson = "", visitId = null;
  const myGifts = () => giftDocs.filter((g) => g.to === S.id);
  function onGifts(docs) {
    giftDocs = docs.filter((g) => g && g.to && g.from && g.town);
    for (const g of myGifts()) {
      if (seenGifts.has(g.id)) continue;
      seenGifts.add(g.id);
      if (g.t > bootT) { SOUND.fx("quest"); toast(` ${g.fromName} left something at your house in ${g.town}.`); }
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
    const pack = G.handable(S).filter((r) => !r.stolen).slice(0, 30);   // worn gear never shows in a gift list
    return `<p class="sub" style="margin:0">${esc(hn)} · ${esc(town)}</p><h2 style="margin:4px 0">${esc(d.name)}'s home</h2>
      ${typeof HOMEART !== "undefined" ? HOMEART.visit(d, town, visitGifted.has(d.id)) : ""}${d.motto ? `<p class="motto">“${esc(d.motto)}”</p>` : ""}
      <p class="sub">Level ${d.level} ${esc(D.RACES[d.race]?.name || "")}${d.titles?.length ? ` · ${d.titles.map(esc).join(" · ")}` : ""}</p>
      <div class="trophies">${skulls ? `<span> ${skulls} dragon skull${skulls > 1 ? "s" : ""} on the wall</span>` : `<span>No dragon skulls yet</span>`}<span> ${d.cleared || 0} dungeons cleared</span>${d.souls ? `<span> ${d.souls} soul${d.souls > 1 ? "s" : ""} unspent</span>` : ""}${d.ach ? `<span> ${d.ach.n}/${d.ach.total} achievements</span>` : ""}</div>
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
      return `<div class="item" style="flex-wrap:wrap">${g.kind === "dragons" ? ICONART.enemy("Dragon", ["dragon"], 34) : g.kind === "foes" ? ICONART.enemy("Bandit outlaw", ["humanoid"], 34) : ICONART.item(g.item[0], 34)}<div class="t">${g.done ? " " : ""}${esc(g.title)}<span>${esc(g.text)} · reward ${g.gold} gold + ${g.item[1]} ${esc(D.ITEMS[g.item[0]]?.name || "")}${g.top ? ` · most: ${esc(g.top.name)} (${g.top.n})` : ""}</span></div>
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
    const c = myClan(), inv = myClanInvites().filter((x) => x.id !== c?.id);
    if (!c) {
      const sw = (i) => CLANS.COLORS.map((col) => `<button class="swatch ${clanDraft.colors[i] === col ? "on" : ""}" style="background:${col}" data-act="clancol" data-i="${i}" data-id="${col}" aria-label="Colour"></button>`).join("");
      return `<div class="panel"><h2>Clan</h2>
        ${inv.length ? `<div class="list">${inv.map((x) => `<div class="item on">${bannerHTML(x)}<div class="t">${esc(x.name)} [${esc(x.tag)}]<span>${esc(x.founderName)} invites you</span></div><button class="btn sm pri" data-act="clanjoin" data-id="${esc(x.id)}">Accept</button><button class="btn sm" data-act="clanno" data-id="${esc(x.id)}">Decline</button></div>`).join("")}</div>` : ""}
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
      if ((tab === "social" && socTab === "chat") && !document.hidden) continue;
      SOUND.fx("chat");
      toast(` ${d.name}${d.ch === "world" ? "" : d.ch.startsWith("clan:") ? " (clan)" : " (party)"}: ${d.text.slice(0, 70)}${d.text.length > 70 ? "…" : ""}`);
    }
    if (party == null && chatCh !== "world" && chatCh !== "clan") chatCh = "world";
    bump(); renderTabs();
    if ((tab === "social" && socTab === "chat")) { const box = $("#chatlog"); if (box && !(document.activeElement?.id === "chatin")) renderPanel(false); }
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
    return ["Need help!", "On my way", `Meet me at ${here}`, ...(raid ? [` Dragon at ${raid.town}!`] : []), "Trade?", "Group up?", "Thanks!", "GG"];
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
      } else if (d.to === S.id && d.status === "open" && !seenTrades.has(d.id)) { seenTrades.add(d.id); if (typeof INVITES === "undefined") toast(`\uE198 ${d.fromName} offers you a trade. Open \uE106 Social → Trades.`); }
    }
    if ((tab === "log" || tab === "social")) bump();
    invRefresh();
  }
  function openTrade(card, note) {
    const loose = G.handable(S).filter((r) => D.ITEMS[r.item]), cs = catStrip(tradeCat, "tradecat", loose.map((r) => r.item));
    const rows = loose.filter((r) => cs.ok(r.item) || tradeSel.includes(r.id));
    const gv = $("#tgive")?.value || "", av = $("#task")?.value || "";
    tradeTo = card.id;
    const far = card.x == null || !!MP.canTarget(S, card, livePos(), otherPos(card));
    openModal(`<h2>Trade with ${esc(card.name)}</h2><p class="sub">${far && SOCIAL.isFriend(S, card.id) ? " They're not here, so a courier will carry your offer (about an hour of game time). " : ""}What you offer leaves your pack now and comes back if they say no.</p>${note ? `<p class="sub">${esc(note)}</p>` : ""}${cs.bar}
      <div class="list" style="max-height:38vh;overflow:auto">${rows.map((r) => `<div class="item ${tradeSel.includes(r.id) ? "on" : ""}" data-act="tradepick" data-id="${r.id}" role="button" tabindex="0">${ICONART.item(r.item, 30, r)}<div class="t">${tradeSel.includes(r.id) ? "" : "☐"} ${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}<span>worth ${D.ITEMS[r.item].value}</span></div></div>`).join("") || '<p class="sub">Nothing loose in your pack.</p>'}</div>
      <div class="grid2" style="margin-top:10px"><label class="sub">Gold you give<input id="tgive" inputmode="numeric" value="${esc(gv)}" placeholder="0"></label><label class="sub">Gold you ask<input id="task" inputmode="numeric" value="${esc(av)}" placeholder="0 = gift"></label></div>
      <div class="evc"><button class="btn pri" data-act="tradesend">Send offer</button><button class="btn" data-act="close">Cancel</button></div>`);
  }
  async function answerTrade(id, yes) {
    let ok = false, poor = false, bad = false;
    await Store.change("trades", id, (d) => {
      if (d.status !== "open" || !SOCIAL.arrived(d)) return d;
      if (!yes || !MP.offerOk(d)) { ok = true; if (yes) bad = true; return { ...d, status: "declined" }; }   // worn gear in an offer: sent back
      const nx = MP.accept(S, { ...d }); if (!nx) { poor = true; return d; }
      ok = true; return nx;
    });
    if (poor) return toast("You can't afford that.");
    if (bad) { persist(true); renderPanel(true); return toast("That offer held gear someone was wearing, so it went back to them."); }
    if (!ok) return toast("That offer is gone.");
    persist(true); renderPanel(true); toast(yes ? "Deal. The goods are in your pack." : "You turn the offer down.");
  }
  // ------------------------------------------------------------ social: friends, private messages, courier trades
  let guardDocs = [], lastJobId = null;
  let friendDocs = [], dmDocs = [], socTab = "friends", socWith = null, socSearch = "", dmDraft = "", seenDMs = null, seenAdds = new Set(), courierToasted = new Set(), fRemoveAsk = null;
  function onFriends(docs) {
    friendDocs = docs;
    for (const d of SOCIAL.addedMe(docs, S)) if (!seenAdds.has(d.id)) { seenAdds.add(d.id); if ((d.t || 0) > G.now() - 3600) toast(` ${d.name} added you as a friend.`); }
    renderTabs(); if (tab === "social") bump();
  }
  function onDMs(docs) {
    dmDocs = docs.filter((d) => d && d.from && d.to && typeof d.text === "string");
    const first = seenDMs === null; seenDMs = seenDMs || new Set();
    for (const d of dmDocs) if (!seenDMs.has(d.id)) {
      seenDMs.add(d.id);
      if (!first && d.to === S.id && !(tab === "social" && socTab === "msgs" && socWith === d.from)) { toast(` ${d.fromName}: ${d.text.slice(0, 60)}`); SOUND.fx("page"); }
    }
    if (tab === "social" && socTab === "msgs" && socWith) { SOCIAL.markRead(S, dmDocs, socWith); refreshThread(); }
    renderTabs(); if (tab === "social") bump();
  }
  const myIncoming = () => trades.filter((d) => d.to === S.id && d.status === "open" && SOCIAL.arrived(d));
  const partyNews = () => invites.length + chests.length + (coopUI?.myInvites ? coopUI.myInvites().length : 0);
  const socialBadge = () => SOCIAL.unread(S, dmDocs) + SOCIAL.addedMe(friendDocs, S).length + myIncoming().length + partyNews() + chatUnread();
  function courierCheck() {
    for (const d of trades) if (d.to === S.id && d.courier && d.status === "open" && SOCIAL.arrived(d) && !courierToasted.has(d.id)) { courierToasted.add(d.id); toast(` A courier brings an offer from ${d.fromName}. Open  Trades.`); renderTabs(); if (tab === "social") bump(); }
  }
  function publishFriends() { if (Store.online) Store.put("friends", S.id, SOCIAL.record(S)); }
  function friendCard(id) { return cardOf(id) || (SOCIAL.friends(S)[id] ? { id, name: SOCIAL.friends(S)[id].name } : null); }
  let socMoreOpen = false;   // the folded More row on Social, opened by hand
  document.addEventListener("toggle", (e) => { if (e.target?.classList?.contains("socmore-d")) socMoreOpen = e.target.open; }, true);
  function panelSocial() {
    const nDm = SOCIAL.unread(S, dmDocs), nAdd = SOCIAL.addedMe(friendDocs, S).length, inc = myIncoming(), nParty = partyNews(), nChat = chatUnread();
    /* [lightmenus] four big tabs (Party, Company, Friends, Realm); Messages, Trades, Chat and Faction sit in a small "More" row
       under them, badges and all, so every screen is still one tap away */
    const tabBtn = ([k, l]) => `<button class="${socTab === k ? "on" : ""}" data-act="soctab" data-id="${k}" aria-pressed="${socTab === k}">${l}</button>`;
    const cnt = (n) => n ? `<span class="socn"> (${n})</span>` : "";   // the counter sits in its own span so the label still translates
    const prim = [["party", `Party${cnt(nParty)}`], ...(typeof LONGHOUSE !== "undefined" ? [["company", `Company${cnt(LONGHOUSE.badge(S) ? "!" : 0)}`]] : []), ["friends", `Friends${cnt(nAdd)}`], ["realm", "Realm"]];
    const more = [["msgs", `Messages${cnt(nDm)}`], ["trades", `Trades${cnt(inc.length)}`], ["chat", `Chat${cnt(nChat)}`], ...(typeof SIDEUI !== "undefined" ? [["faction", `Faction${cnt(SIDEUI.badge() ? "!" : 0)}`]] : [])];
    /* [phonelayout] the More row folds under one "More" line (its badges add up on it) and opens by itself when you're on one of its screens */
    const moreN = nDm + inc.length + nChat + (typeof SIDEUI !== "undefined" && SIDEUI.badge() ? 1 : 0), inMore = more.some(([k]) => k === socTab);
    const chips = `<div class="seg socseg" role="group" aria-label="Social">${prim.map(tabBtn).join("")}</div><details class="socmore-d"${inMore || socMoreOpen ? " open" : ""}><summary><span class="socmore-l">More</span><span class="socmore-s">Messages, trades, chat</span>${moreN ? `<b class="socmore-n">${moreN}</b>` : ""}</summary><div class="socmore" role="group" aria-label="More">${more.map(tabBtn).join("")}</div></details>`;
    const off = Store.online ? "" : `<p class="sub">You're playing offline. Go online (Map tab) to see friends and messages.</p>`;
    let body = "";
    if (socTab === "friends") {
      if (typeof AVATAR !== "undefined") for (const id of Object.keys(SOCIAL.friends(S))) AVATAR.remember(S, id, cardOf(id));   // [avatars] their portrait, kept for when they're offline
      const fr = Object.entries(SOCIAL.friends(S)).map(([id, f]) => ({ id, name: f.name, pic: f.pic, card: cardOf(id) })).map((f) => ({ ...f, st: SOCIAL.status(f.card) })).sort((a, b) => b.st.online - a.st.online || a.name.localeCompare(b.name));
      const q = socSearch.trim().toLowerCase();
      const found = q.length >= 2 ? others.filter((o) => o.name?.toLowerCase().includes(q) && !SOCIAL.isFriend(S, o.id)).slice(0, 8) : [];
      const adds = SOCIAL.addedMe(friendDocs, S);
      body = `${adds.length ? `<h3>Added you</h3>${adds.map((d) => `<div class="item on"><div class="t">${esc(d.name)}<span>wants to be friends</span></div><button class="btn sm pri" data-act="faddrec" data-id="${esc(d.id)}">Add back</button></div>`).join("")}` : ""}
        <h3 style="margin-top:8px">Your friends · ${fr.length}</h3>
        ${fr.length ? fr.map((f) => `<div class="item frow" style="flex-wrap:wrap">${typeof AVATAR !== "undefined" ? AVATAR.face(f.card, f.pic, 44) : HEROART.portrait(f.card || { race: "nord", id: f.id }, 38)}${(() => { const fj = typeof FRIENDJOIN !== "undefined" ? FRIENDJOIN.rowHTML(f.card, esc) : null; f.fj = fj; return fj ? `<div class="t fj-t"><i class="onl on"></i>${esc(f.name)}${fj.act}<span>${esc(fj.line)}</span><span class="fj-party${fj.full ? " full" : ""}">${esc(fj.party)}</span>${fj.why ? `<span class="fj-why">${esc(fj.why)}</span>` : ""}</div>` : `<div class="t"><i class="onl ${f.st.online ? "on" : ""}"></i>${esc(f.name)}<span>${esc(f.st.text)}</span></div>`; })()}
          <div class="fbtns">${f.fj?.btn || ""}<button class="btn sm" data-act="fmsg" data-id="${esc(f.id)}"> Message</button><button class="btn sm" data-act="ftrade" data-id="${esc(f.id)}"> Trade</button>${fRemoveAsk === f.id ? `<button class="btn sm danger" data-act="fdel" data-id="${esc(f.id)}">Really remove?</button>` : `<button class="btn sm" data-act="fdelask" data-id="${esc(f.id)}" aria-label="Remove friend">✕</button>`}</div></div>`).join("")
          : `<p class="sub">No friends yet. Add people from Social → Party (travellers near you), or search below.</p>`}
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
          + (more.length ? `<h3 style="margin-top:10px">Write to a friend</h3>${more.map(([id, f]) => `<div class="item"><div class="t">${esc(f.name)}</div><button class="btn sm" data-act="fmsg" data-id="${esc(id)}"> Write</button></div>`).join("")}` : "");
      }
    } else if (socTab === "company" && typeof LONGHOUSE !== "undefined") {
      return `<div class="panel soc-co"><h2> Friends & messages</h2>${chips}${LONGHOUSE.panel({ inner: true })}${off}</div>`;   // longhouse.js: the adventuring company, its hall right under the tab row
    } else if (socTab === "faction" && typeof SIDEUI !== "undefined") {
      return `<div class="panel"><h2> Friends & messages</h2>${chips}${off}</div>${idPanel("faction", SIDEUI.panel())}`;   // sides.js: your side, rank, cloaks, the war
    } else if (socTab === "party" || socTab === "chat" || socTab === "realm") {
      // [journal] the people side that used to live in the Journal
      const x = socialBits();
      const blocks = socTab === "party" ? [["coop", coopUI ? coopUI.invitesHTML() : ""], ["party", x.party], ["people", x.people]]
        : socTab === "chat" ? [["chat", chatPanel()], ["world", x.world], ["news", x.news]]
        : [["holds", holdsPanel()], ["ladder", x.ladder]];   // clans are gone: your side lives in the Faction tab (sides.js)
      const shown = blocks.filter(([, h]) => h && h.trim()).map(([id, h]) => idPanel(id, h));
      const intro = { party: "Your party, co-op invites and everyone travelling near you.", chat: "Talk to everyone online, and what's happening in the world.", realm: "Who rules the holds for which side, and the leaderboard." }[socTab];
      return `<div class="panel"><h2> Friends & messages</h2>${chips}${off}<p class="sub">${intro}</p></div>${shown.join("") || `<div class="panel"><p class="sub">Nothing here yet.</p></div>`}`;
    } else {
      const outC = trades.filter((d) => d.from === S.id && d.status === "open"), onWay = trades.filter((d) => d.to === S.id && d.status === "open" && !SOCIAL.arrived(d));
      body = `${inc.length ? inc.map((d) => `<div class="item on" style="flex-wrap:wrap"><div class="t">${d.courier ? " " : ""}${esc(d.fromName)} offers ${esc(MP.describe(d))}${(d.items || []).length ? `<span class="icorow">${d.items.slice(0, 4).map((x) => ICONART.item(x.item, 26, x)).join("")}</span>` : ""}<span>${d.ask ? `for ${d.ask} gold (you have ${S.gold})` : "as a gift"}</span></div><div class="fbtns"><button class="btn sm pri" data-act="tradeyes" data-id="${esc(d.id)}" ${S.gold >= d.ask ? "" : "disabled"}>Accept</button><button class="btn sm" data-act="tradeno" data-id="${esc(d.id)}">Decline</button></div></div>`).join("") : `<p class="sub">No offers waiting for you.</p>`}
        ${onWay.length ? `<h3 style="margin-top:10px">Couriers on the way to you</h3>${onWay.map((d) => `<div class="item"><div class="t"> From ${esc(d.fromName)}<span>arrives in ${cdSpan(d.arrive)}</span></div></div>`).join("")}` : ""}
        ${outC.length ? `<h3 style="margin-top:10px">Your offers</h3>${outC.map((d) => `<div class="item"><div class="t">${d.courier ? " " : ""}To ${esc(d.toName)}: ${esc(MP.describe(d))}<span>${d.ask ? `asking ${d.ask} gold` : "gift"} · ${d.courier && !SOCIAL.arrived(d) ? `courier arrives in ${cdSpan(d.arrive)}` : "waiting for an answer"}</span></div><button class="btn sm" data-act="tradecancel" data-id="${esc(d.id)}">Withdraw</button></div>`).join("")}` : ""}
        <p class="sub" style="margin-top:10px">To send an offer, tap  Trade next to a friend. If they're not in the same place, a courier carries it (about an hour of game time). What you offer leaves your pack at once and comes back if they say no.</p>`;
    }
    return `<div class="panel"><h2> Friends & messages</h2>${chips}${off}${body}</div>`;
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
  let duels = [], seenDuels = new Set(), arenaStake = typeof FASTQOL !== "undefined" ? FASTQOL.mem("arenaStake", 100) : 100;
  function onDuels(docs) {
    duels = docs;
    for (const d of docs) {
      if (d.from === S.id && d.status !== "open") { if (d.status === "done") { festCount("duel"); if (d.winner === S.id) warPoint("duel", "Eastmarch"); } const m = ARENA.settle(S, d); Store.remove("duels", d.id); if (m) { persist(true); SOUND.fx(d.winner === S.id ? "victory" : "click"); toast("\uE101 " + m); } }
      else if (d.to === S.id && d.status === "open" && !seenDuels.has(d.id)) { seenDuels.add(d.id); if (d.t > bootT) { SOUND.fx("shout"); if (typeof INVITES === "undefined") toast(`\uE101 ${d.fromName} challenges you in the Windhelm Arena${d.stake ? ` for ${d.stake} gold` : ""}!`); } }
    }
    if (tab === "town") bump();
    invRefresh();
  }
  function arenaHTML() {
    const a = ARENA.me(S), t = G.now();
    const inc = duels.filter((d) => d.to === S.id && d.status === "open" && t - d.t < ARENA.OPEN_MIN * 60), out = duels.filter((d) => d.from === S.id && d.status === "open");
    const fighters = others.filter((o) => o.loc === ARENA.TOWN && o.id !== S.id);
    const board = ARENA.board(ladderDocs, S).slice(0, 10);
    const RA = typeof RAIDART !== "undefined" ? RAIDART : null;
    return `${RA ? RA.arenaHTML() + RA.seasonBanner(ARENA.seasonName()) + RA.podium(board.slice(0, 3), raPortrait, UIART.rank) : ""}<div class="card"><h3 class="ico-h">${UIART.rank(a.rating, 30)} ${RA ? "Your standing" : `Season of ${esc(ARENA.seasonName())}`}</h3><p class="sub" style="margin:0">Your rating ${a.rating} · ${a.w} won, ${a.l} lost. Nobody dies in the Arena: the loser kneels and the healers patch everyone up.</p></div>
      ${inc.length ? `<h3 style="margin-top:12px">Challenges for you</h3>${inc.map((d) => `<div class="item on" style="flex-wrap:wrap">${RA ? RA.versus({ id: d.from, name: d.fromName }, { id: S.id, name: S.name }, d.stake, raPortrait) : ""}<div class="t">${esc(d.fromName)}<span>${d.stake ? `Stake ${d.stake} gold each · winner takes ${d.stake * 2}` : "A friendly bout, no bet"} · rating ${d.aRating}</span></div>
        <div style="display:flex;gap:6px"><button class="btn sm pri" data-act="duelyes" data-id="${esc(d.id)}" ${S.gold >= d.stake ? "" : "disabled"}>Accept</button><button class="btn sm" data-act="duelno" data-id="${esc(d.id)}">Decline</button></div></div>`).join("")}` : ""}
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
    if (res) { festCount("duel"); if (res.doc.winner === S.id) warPoint("duel", "Eastmarch"); if (res.fight && !res.fight.foeLook) res.fight.foeLook = cardOf(res.doc.from)?.look || null; }
    if (res) { if (typeof RAIDART !== "undefined") RAIDART.cheer(4000); SOUND.fight({ fight: res.fight, died: res.doc.winner !== S.id }); postNews(` ${res.doc.winner === S.id ? S.name : res.doc.fromName} beat ${res.doc.winner === S.id ? res.doc.fromName : S.name} in the Windhelm Arena${res.doc.pot ? ` and won ${res.doc.pot} gold` : ""}.`);
      openModal(`<h2>${res.doc.winner === S.id ? "Victory in the Arena" : "Beaten, not broken"}</h2><p>${esc(res.text)}</p>${fightLog(res.fight)}${skillLine(res)}${typeof FASTQOL !== "undefined" ? FASTQOL.againHTML("duel", res.doc.from) : ""}<button class="btn pri" data-act="close" style="width:100%">Continue</button>`); }
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
      if (r.warHold) warPoint("pvp", r.warHold);   // sides.js: you beat off an attacker from another side
      persist(true); closeDungeon(); renderPanel(true);
      if (S.pickTemple && typeof PVPDEATH !== "undefined") { openModal(`<p>${esc(r.text)}</p>${PVPDEATH.pickHTML(S, esc)}`); continue; }
      showMessage(r.bad ? "On the road" : "Word reaches you", r.text, r.bad);
    }
  }
  function cardOf(id) { return others.find((o) => o.id === id); }
  /* [map-panels] another hero's panel on the map: Invite, Trade, Friend (the same buttons as Social → Travellers) */
  function heroActs(o) {
    if (!Store.online) return [];
    const inP = party?.members.some((m) => m.id === o.id), near = !MP.canTarget(S, o, livePos(), otherPos(o)), out = [];
    if (!inP) out.push({ label: "Invite to your party", sub: party && party.leader !== S.id ? "Only your party leader can invite" : "They'll see it under Social → Party", off: !!party && party.leader !== S.id, data: { act: "invite", id: o.id } });
    out.push({ label: "Trade", sub: near ? "Swap items and gold" : "Get to the same place to trade", off: !near, data: { act: "trade", id: o.id } });
    if (!SOCIAL.isFriend(S, o.id)) out.push({ label: "Add as a friend", sub: "See where they are and send messages", data: { act: "fadd", id: o.id } });
    return out;
  }
  function allies() {
    if (typeof PARTY !== "undefined") PARTY.clear();
    if (S.trip?.caravan) {   // guarding a caravan: the other guards who signed on fight with you, plus two hired swords
      const id = S.trip.caravan, mates = guardDocs.filter((g) => g.caravanId === id && g.uid !== S.id && g.status !== "left");
      return [...mates.map((g) => MP.allyFromCard(cardOf(g.uid) || { name: g.name, dmg: 4 + (g.level || 1) * 0.6 })), { name: "Caravan guard", dmg: 4 + S.level * 0.3 }, { name: "Caravan guard", dmg: 4 + S.level * 0.3 }];
    }
    if (S.dungeon?.run && coopUI) return coopUI.allies();   // a co-op run: whoever is in your room
    if (!party) return [];
    const me = livePos();
    if (typeof PARTY !== "undefined") return PARTY.allies(S, party, others, me, (o) => otherPos(o), MP.NEAR_PX);   // party members close by, each fighting by their own tactics
    return others.filter((o) => party.members.some((m) => m.id === o.id) && (S.dungeon ? o.dungeon === S.dungeon.place : (!o.dungeon && G.pxDist(otherPos(o), me) <= MP.NEAR_PX)))
      .map(MP.allyFromCard);
  }
  /* open the Area tab after arriving (arrivearea.js); like tapping it, without scrolling a phone away from the map */
  function goArea() {
    if (tab === "town" && !$("#sky")) return;
    closeMenu(); tab = "town"; bump(); renderTabs(); renderPanel(true);
    if (typeof PCMAP !== "undefined" && PCMAP.on()) PCMAP.refresh();
    if (typeof MOTION !== "undefined") MOTION.panel($("#side"));
  }
  function followParty() {
    const tr = party?.trip;
    if (!tr || party.leader === S.id || tr.t <= (S.followT || 0) || S.dungeon || (S.trip && S.trip.status !== "travel")) return;
    if (G.now() - tr.t > 600) return;
    if (G.pxDist([S.x, S.y], tr.start) > 40) return;
    S.followT = tr.t;
    const err = G.startTrip(S, tr.destName, tr.dest);
    if (err) return;
    S.trip.speed = tr.speed; S.trip.total = G.minutesLeft(S); S.trip.follow = party.leader;   // the leader decides what happens on the way
    persist(true);
    toast(`⚑ You follow ${party.leaderName} to ${tr.destName}. They lead the way and handle what you meet.`);
  }
  function checkAmbush() {
    if (!S.ambush) return;
    if (S.trip || S.location || S.dungeon) { S.ambush = false; publishCard(); return; }
    if (Date.now() - lastAmbushCheck < 3000 || $("#modal")) return;
    lastAmbushCheck = Date.now();
    const me = [S.x, S.y], t = G.now();
    const victim = others.find((o) => o.moving && !party?.members.some((m) => m.id === o.id) && G.pxDist(otherPos(o, t), me) <= MP.AMBUSH_PX && (o.safeUntil || 0) < t && !(S.ambushed || {})[o.id] && (typeof SIDES === "undefined" || !SIDES.canAttack(S, o, { ambush: true, party }).err));
    if (!victim) return;
    S.ambushed = { ...(S.ambushed || {}), [victim.id]: t };
    S.ambush = false;
    doAttack(victim, true);
  }
  function doAttack(card, ambush = false) {
    if (typeof SIDES !== "undefined") {   // sides.js: soldiers of different sides may fight anywhere in the same hold (always asked first)
      const c = SIDES.canAttack(S, card, { ambush, party, myPos: livePos(), theirPos: otherPos(card) });
      if (c.err) return toast(c.err);
      if (c.mode === "war") {
        const go = () => tbCall(() => SIDES.attack(S, card, { ambush, pos: livePos() }), (r) => { if (r.won && r.warHold) warPoint("pvp", r.warHold); attackDone(r); });
        return ambush || typeof SIDEUI === "undefined" ? go() : SIDEUI.confirmAttack(card, go);
      }
    }
    const err = ambush ? null : MP.canTarget(S, card, livePos(), otherPos(card));
    if (err) return toast(err);
    tbCall(() => MP.attack(S, card, { ambush, pos: livePos() }), (r) => attackDone(r));
  }
  function attackDone(r) {
    if (r.doc) Store.put("attacks", r.id, r.doc);
    if (r.news) postNews(r.news);
    if (r.bag) Store.addBag(r.bag);
    persist(true); renderPanel(true);
    openModal(`<h2>${r.won ? " Victory" : r.died ? " Defeated" : "Fight"}</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}${r.died ? `<p>${esc(r.died)}</p>` : ""}${skillLine(r)}${r.died && S.pickTemple && typeof PVPDEATH !== "undefined" ? PVPDEATH.pickHTML(S, esc) : ""}<button class="btn ${r.died ? "danger" : "pri"}" data-act="close" style="width:100%">Continue</button>`, r.died ? "enc" : "");
  }
  function doPickpocket(card) {
    const err = MP.canTarget(S, card, livePos(), otherPos(card));
    if (err) return toast(err);
    const go = (plan) => {
      const r = MP.pickpocket(S, card, undefined, undefined, plan);
      pickDone(r);
    };
    if (typeof PICKGAME !== "undefined" && PICKGAME.wants() && MP.pickPlan && !MP.pickWait?.(S, card.id)) {
      const plan = MP.pickPlan(S, card);
      if (plan.purse) return PICKGAME.open({ title: `${card.name}'s purse`, sub: `Pickpocket ${G.skill(S, "Pickpocket")} · about ${Math.round(plan.chance * 100)}% chance`, chance: plan.chance }, (res) => {
        if (res.left) return;
        go(res.auto ? plan : { ...plan, hit: res.hit });
      });
    }
    go(null);
  }
  function pickDone(r) {
    if (r.doc) Store.put("attacks", r.id, r.doc);
    if (r.news) postNews(r.news);
    persist(true); renderPanel(true);
    showMessage("Pickpocket", r.text + ((r.skills || []).length ? "  " + r.skills.join(" · ") : ""), !r.skills);
  }
  async function invite(card) {
    if (party?.members.some((m) => m.id === card.id)) return toast(`${card.name} is already in your party.`);
    if (party && party.leader !== S.id) return toast("Only your party leader can invite.");
    if (typeof SAMEVER !== "undefined" && SAMEVER.blockWith(cardOf(card.id) || card, card.name)) return;   // different builds can't play together: say why

    const cap = typeof PARTYPLAY !== "undefined" ? PARTYPLAY.MAX_PARTY : 8;
    if (party && party.members.length + (party.invites || []).length >= cap) return toast(`A party holds up to ${cap} heroes.`);
    if (party) { await Store.change("parties", party.id, (p) => ({ ...p, invites: [...new Set([...(p.invites || []), card.id])] })); }
    else { const id = nid(); await Store.put("parties", id, { leader: S.id, leaderName: S.name, members: [{ id: S.id, name: S.name }], invites: [card.id], t: G.now() }); }
    toast(`Invited ${card.name}. They'll see it under  Social → Party.`);
  }
  async function acceptInvite(pid) {
    const cap = typeof PARTYPLAY !== "undefined" ? PARTYPLAY.MAX_PARTY : 8;
    const p0 = invites.find((p) => p.id === pid);
    if (!p0) { invRefresh(); return toast("That party is gone."); }
    if (typeof SAMEVER !== "undefined" && SAMEVER.blockWith(cardOf(p0.leader), p0.leaderName)) return;   // the leader is on another build: update first
    if (p0.members.filter((m) => m.id !== S.id).length >= cap) {   // full: say so, and don't leave your own party for nothing
      await Store.change("parties", pid, (p) => ({ ...p, invites: (p.invites || []).filter((x) => x !== S.id) }));
      return toast(`That party is full (${cap} heroes at most).`);
    }
    if (party) await leaveParty();
    const r = await Store.change("parties", pid, (p) => (p.members.filter((m) => m.id !== S.id).length >= cap ? { ...p, invites: (p.invites || []).filter((x) => x !== S.id) } : { ...p, invites: (p.invites || []).filter((x) => x !== S.id), members: [...p.members.filter((m) => m.id !== S.id), { id: S.id, name: S.name }] }));
    toast(r?.after?.members?.some((m) => m.id === S.id) ? `You joined ${p0.leaderName}'s party. The leader makes the choices.` : r ? `That party is full (${cap} heroes at most).` : "That party is gone.");
    publishCard();
  }
  async function declineInvite(pid) {
    const r = await Store.change("parties", pid, (p) => ({ ...p, invites: (p.invites || []).filter((x) => x !== S.id), nos: typeof INVITES !== "undefined" ? INVITES.nos(p, S) : p.nos }));
    toast(!r ? "That invite is gone." : r.before?.leaderName ? `You declined ${r.before.leaderName}'s party invite.` : "You declined the party invite.");
    invRefresh();
  }
  // ------------------------------------------------------------ invite cards (invites.js): Accept / Decline right on top of the screen
  const seenNos = new Set();
  const invRefresh = () => { if (typeof INVITES !== "undefined") INVITES.refresh(); };
  const myClanInvites = () => CLANS.invitesFor(S.id).filter((x) => !(S.invNo || {})["clan:" + x.id]);
  function inviteList() {
    if (!S || typeof INVITES === "undefined" || !Store.online) return [];
    const t = G.now(), c = myClan();
    return INVITES.list(S, { parties: invites, runs: coopUI?.myInvites ? coopUI.myInvites() : [], clans: myClanInvites().filter((x) => x.id !== c?.id), inClan: !!c,
      duels: duels.filter((d) => d.to === S.id && d.status === "open" && t - d.t < ARENA.OPEN_MIN * 60), trades: myIncoming().map((d) => ({ ...d, what: MP.describe(d) })), gold: S.gold, face: typeof AVATAR !== "undefined" ? (uid) => AVATAR.face(cardOf(uid), SOCIAL.friends(S)[uid]?.pic, 30) : null, joins: typeof FRIENDJOIN !== "undefined" ? FRIENDJOIN.cards() : [] });
  }
  async function answerInviteCard(kind, id, yes) {
    if (kind === "party") await (yes ? acceptInvite(id) : declineInvite(id));
    else if (kind === "coop" && coopUI) await coopUI.act({ dataset: { act: yes ? "coopjoin" : "coopno", id } });
    else if (kind === "clan") yes ? clanJoin(id) : clanDecline(id);
    else if (kind === "duel") await answerDuel(id, yes);
    else if (kind === "trade") await answerTrade(id, yes);
    else if (kind === "join" && typeof FRIENDJOIN !== "undefined") await FRIENDJOIN.reply(id, yes);
    bump(); if (tab === "social" || tab === "town") renderPanel(true);
  }
  function clanJoin(id) { const r = CLANS.join(S, CLANS.byId(id)); if (r.err) return toast(r.err); persist(true); say(r.text); }
  function clanDecline(id) {
    const c = CLANS.byId(id), t = G.now();
    INVITES.remember(S, "clan:" + id, t);   // the founder's record isn't ours to edit: hide it here, and leave them a note
    if (Store.online) Store.put("clanmem", S.id, { clan: S.clan || null, name: S.name, t, no: { clan: id, t } });
    persist(); invRefresh();
    toast(c ? `You declined the invite to ${c.name}.` : "That invitation is gone.");
  }
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
    postNews(` ${S.name} took everything from the party chest at ${place}. Betrayal!`);
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
  function guardAction(c) { tbCall(() => TOWNS.guardChoice(S, c), (r) => guardDone(c, r)); }
  function guardDone(c, r) {
    if (r.bag) Store.addBag(r.bag);
    persist(true); renderPanel(true);
    if (r.stay) return openGuard(r.text);
    if (r.died || r.fight) return showFightResult(r);
    showMessage("The guard", r.text);
  }

  // ------------------------------------------------------------ panels
  /* [ux] a small header on every tab: what this screen is, with an ⓘ that explains it in plain words */
  const SCREEN_HELP = {
    map: ["Map", "Pick where to go", "The card at the top says what to do next. Press Go to walk there: trips keep going while the app is closed. The gold ◆ on the map is your current quest; tap empty ground to roam off the road."],
    hero: ["Character", "Level, skills and perks", "Skills grow as you use them. When you level up, choose Health, Magicka or Stamina and spend perk points in a skill's tree. Below are your powers, shouts, standing stone and achievements."],
    pack: ["Pack", "What you carry and wear", "Open your things to wear, use, compare or drop them. Use the search box to find an item by name. Heavy packs slow you down: sell things or store them at home."],
    town: ["Area", "Places in this town", "Places are grouped like a town: Inn, Market, Services & trainers, Work & jobs, Your home, and Events & fun. Tap one to open it; the ‹ button brings you back. Things ready for you show on top under Right now. Shops close at night (20:00–08:00)."],
    log: ["Journal", "Your quests", "Active quests sit on shelves: main story, Solstheim, Civil War, guilds, Daedric and side quests. Misc holds jobs, bounties, cures and treasure maps. ☆ Track a quest to steer the compass, the map and the What to do next card. Chat, party and the world moved to  Friends; stats and the diary to Character."],
    social: ["Social", "Friends, messages and trades", "Add players as friends, send them messages, and trade by courier from anywhere."],
  };
  function screenHead() {
    const h = SCREEN_HELP[tab]; if (!h) return "";
    return `<div class="uxhead"><div class="uxh-t"><b>${h[0]}</b><span>${h[1]}</span></div><button class="uxi" data-act="uxhelp" data-id="${tab}" aria-label="What is this screen?" aria-expanded="${uxHelpOpen === tab}">ⓘ</button></div>
      ${uxHelpOpen === tab ? `<div class="uxpop" role="note"><p>${h[2]}</p>${typeof CC !== "undefined" ? CC.legend() : ""}<button class="btn sm" data-act="uxhelp" data-id="${tab}">Got it</button></div>` : ""}`;
  }
  /* locscreen.js: the Area tab at a real place opens as a painted scene ("" = no scene: another tab, a shop open, List mode) */
  function locScene() {
    const L = typeof LOCSCREEN !== "undefined" ? LOCSCREEN : null;
    if (!L || !S || tab !== "town" || !townCtx || $("#sky") || L.mode(S) !== "scene" || L.placeOf(S) !== townCtx.l) return "";
    const c = townCtx, l = c.l, gather = typeof GATHERUI !== "undefined" ? GATHERUI.html(S) : "";   // gatherui.js: its g* buttons reach onPanelClick through #locs
    const players = others.filter((o) => o && o.id !== S.id && o.loc === l && !o.hiding).map((o) => ({ name: typeof GREET !== "undefined" ? GREET.label(S, o, party) : o.name, sub: party && party.members?.some((m) => m.id === o.id) ? "In your party" : "Player" }));
    try {
      if (c.town) return L.html({ S, l, sections: c.sections, names: c.names, open: c.open, hold: c.hold, wanted: c.wanted, players, sheets: { gather, news: c.news.join("") + (c.rumours || "") } });
      return L.html({ S, l, sections: [], players, sheets: { main: placeHere(), gather, hunt: typeof LEGHUNT !== "undefined" ? LEGHUNT.wildHTML(S, esc) : "", camp: wildsFood() } });
    } catch (e) { console.warn("locscreen", e); return ""; }
  }
  function renderPanel(force) {
    const side = $("#side"); if (!side) return;   // the game screen isn't up yet (title or intro)
    if (typeof RIDING !== "undefined" && S) RIDING.sync(S);   // the map's ride button: a horse just bought, back on its feet, out of a dungeon …
    if (!force && side.contains(document.activeElement) && document.activeElement.matches("input,select")) return;
    rendered = version; lastPanelRender = Date.now();
    if (tab === "tactics") tab = "hero";   // the old AI & Loadouts tab is gone
    const mtFresh = typeof MENUTOP !== "undefined" && MENUTOP.fresh(side, MENUTOP.panelKey(tab, tab === "log" ? jTab : "", tab === "social" ? socTab : ""));   // menutop.js: a new screen starts at its top
    side.dataset.tab = tab; townCtx = null;
    const openD = [...side.querySelectorAll("details")].map((d) => d.open), y = scrollY;
    const twp = typeof TABMENU !== "undefined" ? { stars: () => TABMENU.stars(S), perks: () => TABMENU.perks(S) } : {};
    const mnp = typeof MENUS !== "undefined" ? MENUS.panels({ S, ach: achPanel, settings: settingsHTML, fest: festPanel, idPanel, update: updNewer() ? { ...(update || {}), newer: true } : update }) : {};   // menus.js: tab homes
    side.innerHTML = tutTip() + (typeof MENUS !== "undefined" ? MENUS.subnav(tab) : "") + screenHead() + ({ ...mnp, map: panelTravel, hero: panelHero, pack: panelPack, town: () => { const t = panelTown(); return (townCtx && typeof LOCSCREEN !== "undefined" ? LOCSCREEN.sceneBtn() : "") + (typeof ARRIVEAREA !== "undefined" ? ARRIVEAREA.gatherHTML(S) : "") + t; }, log: panelLog, social: panelSocial, stats: panelStats, diary: panelDiary, places: panelPlaces, follower: () => typeof FOLTAB !== "undefined" ? FOLTAB.panel(S, esc, svgI) : "", ...twp }[tab] || panelTravel)();
    if (typeof TABMENU !== "undefined") TABMENU.afterPanel(tab);
    if (typeof MENUS !== "undefined") MENUS.afterPanel(tab);
    if (typeof MENUS2 !== "undefined") MENUS2.afterPanel(tab, side);   // menus2.js: Find a quest
    if (tab === "town" && typeof AREAUI !== "undefined") AREAUI.fitSoon(side);   // areaui.js: one or two columns of places
    if (typeof LOCSCREEN !== "undefined") LOCSCREEN.show(locScene());   // locscreen.js: the place full screen
    if (!force) { side.querySelectorAll("details").forEach((d, i) => { if (openD[i] != null) d.open = openD[i]; }); scrollTo(0, y); }
    else if (mtFresh) MENUTOP.top();
    const cl = $("#chatlog"); if (cl) cl.scrollTop = cl.scrollHeight;
  }

  /* [ux] "What to do next": the current quest goal, things waiting for you, the next guide step and a place nearby */
  function nextCard() {
    if (S.dungeon) return "";
    const here = livePos(), eta = (n) => fmtMin(G.pxDist(here, WORLD.places[n]) * 1.1 / G.speed(S));
    const rows = [], MP = typeof MAPPANEL !== "undefined" ? MAPPANEL : null, R = [];   // mappanel.js: one merged, sorted card (with remind.js's Today rows)
    const dist = (n) => (n && WORLD.places[n] ? G.pxDist(here, WORLD.places[n]) : 0);
    const row = (ico, title, sub, btn, m = {}) => { const html = `<div class="item nx"><span class="nx-i" aria-hidden="true">${ico}</span><div class="t">${title}<span>${sub}</span></div>${btn || ""}</div>`; rows.push(html); R.push({ ...m, dist: dist(m.place), html }); };
    if (S.trip && S.trip.destName) row("", `On the way to ${esc(S.trip.destName)}`, "You keep travelling even with the app closed.", "", { kind: "trip", key: "trip" });
    QUESTS.ensure(S);
    const a = QUESTS.tracked(S);
    if (a) {
      const n = QUESTS.target(a.st), at = n && S.location === n, o = a.st.obj;
      const btn = o.talk && at ? `<button class="btn sm pri" data-act="qtalk" data-id="${a.id}">${esc(o.label)}</button>`
        : n && !at && WORLD.places[n] && !(S.trip && S.trip.destName === n) ? `<button class="btn sm pri" data-act="go" data-place="${esc(n)}">Go</button>` : "";
      row("◆", `${esc(a.st.title)} <small class="nx-q">${esc(a.def.name)}</small>`, `${esc(a.st.text)}${n && !at && WORLD.places[n] ? ` · ${esc(n)} is ~${eta(n)} away` : ""}`, btn, { kind: "quest", key: "quest", place: n && !at ? n : null });
    }
    if ((S.pendingLevels > 0 || PERKS.pointsLeft(S) > 0) && !(MP && typeof REMIND !== "undefined")) row("", S.pendingLevels > 0 ? "You can level up" : `${PERKS.pointsLeft(S)} perk point${PERKS.pointsLeft(S) > 1 ? "s" : ""} to spend`, "Open Character to choose what grows.", `<button class="btn sm" data-act="uxtab" data-id="hero">Character</button>`);
    if (S.location && !S.trip && (TOWNS.isTown(S.location) || G.shopTypes(S.location).length)) row("", `You're in ${esc(S.location)}`, "Shops, the inn, trainers and jobs are in the Area tab.", `<button class="btn sm" data-act="uxtab" data-id="town">Area</button>`, { kind: "town", key: "town" });
    const ob = typeof ONBOARD !== "undefined" ? ONBOARD.rows(S, { here, eta, known, quest: a?.id, online: Store.online, party: !!party, max: 4 - rows.length }) : null;   // [onboard] 1-3 ideas from your state
    if (ob) { rows.push(...ob); ob.forEach((html, i) => { const place = MP ? MP.placeOf(html) : null; R.push({ kind: "idea", key: `idea${i}`, place, dist: dist(place), html }); }); }
    const g = !ob && typeof GUIDE !== "undefined" && S.level < 15 ? GUIDE.STEPS.find((st) => !st[3](S)) : null;
    if (g) row("", `Next step: ${esc(g[1])}`, esc(g[2]), `<button class="btn sm" data-act="guidego" data-id="${g[0]}">Show me</button>`, { kind: "guide", key: "guide" });
    if (!S.trip) {
      const near = Object.keys(WORLD.places).filter((n) => known(n) && n !== S.location && !S.discovered.includes(n)).map((n) => [n, G.pxDist(here, WORLD.places[n])]).sort((x, y) => x[1] - y[1])[0];
      if (near && (MP || rows.length < 4)) row("✦", `Explore ${esc(near[0])}`, `${KIND[WORLD.places[near[0]][2]]} you haven't visited · ~${eta(near[0])}`, `<button class="btn sm" data-act="go" data-place="${esc(near[0])}">Go</button>`, { kind: "explore", key: "explore", place: near[0] });
    }
    if (MP) {
      const rm = typeof REMIND !== "undefined" ? REMIND.items(S) : [];
      for (const { x, html } of rm) R.push({ kind: x.state === "ready" ? (x.kind === "hero" ? "hero" : "ready") : x.state, key: x.key, place: x.place && x.place !== S.location ? x.place : null, at: x.at, dist: x.place ? dist(x.place) : 0, html });
      return MP.card(R, ob && ob.length ? ONBOARD.foot() : "");
    }
    if (!rows.length) return "";
    return `<div class="panel nextcard"><h2>What to do next</h2><div class="list">${rows.join("")}</div>${ob && ob.length ? ONBOARD.foot() : ""}</div>`;
  }
  function panelTravel() {
    const here = livePos();
    const MP = typeof MAPPANEL !== "undefined" ? MAPPANEL : null;   // mappanel.js: All / Towns / Dungeons / Not visited / Other
    const all = Object.keys(WORLD.places).filter((n) => known(n) && n !== S.location && WORLD.same(here, WORLD.places[n]) && n.toLowerCase().includes(searchText.toLowerCase()))
      .map((n) => ({ n, d: G.pxDist(here, WORLD.places[n]), kind: WORLD.places[n][2], visited: S.discovered.includes(n) })).sort((a, b) => a.d - b.d);
    const places = MP ? all.filter((p) => MP.match(p.kind, p.visited)) : all;
    const bag = myBag();
    return `${ppUI ? ppUI.panelHTML() : ""}${typeof WFX !== "undefined" ? WFX.coldHTML(S) : ""}${nextCard()}${typeof REMIND !== "undefined" && typeof MAPPANEL === "undefined" ? REMIND.card(S) : ""}${placeHere()}${typeof EXPLORE !== "undefined" ? EXPLORE.placeCard(S) : ""}${typeof RUMOURS !== "undefined" ? RUMOURS.card(S) : ""}<div class="panel"><h2>Where to?</h2><p class="sub">Tap a place on the map, or press <b>Go</b> below. Tap empty ground on the map to roam off the road.</p>${typeof FASTQOL !== "undefined" ? FASTQOL.recentHTML(S) : ""}
      <input id="search" placeholder="Search places" value="${esc(searchText)}" autocomplete="off" aria-label="Search places">${MP ? MP.chips(MP.countAll(all)) : ""}
      <div class="list">${bag ? `<div class="item on"><div class="t"> Your lost bag<span>${bag.gold} gold · ${Math.max(0, Math.floor((bag.expires - G.now()) / 60))} min left before it's fair game</span></div><button class="btn pri sm" data-act="go" data-place="__bag">Go</button></div>` : ""}
      ${places.slice(0, searchText || uxAllPlaces ? 40 : 8).map(({ n, d }) => { const k = WORLD.places[n][2]; return `<div class="item"><div class="t">${esc(n)}<span>${KIND[k]} · ${esc(G.holdAt(WORLD.places[n]))}${typeof PLACESTUFF !== "undefined" ? PLACESTUFF.tag(n) : ""}${S.discovered.includes(n) ? "" : " · unvisited"}${(() => { const lf = DUNGEONS.enterable(n) ? DUNGEONS.refillLeft(S, n) : 0; return lf ? ` ·  opens in ${cdSpan(G.now() + lf)}` : ""; })()}</span></div><span class="num sub">${d * 1.1 / G.speed(S) < 1 ? "" : "~"}${fmtMin(d * 1.1 / G.speed(S))}</span><button class="btn sm" data-act="go" data-place="${esc(n)}">Go</button></div>`; }).join("") || (searchText ? `<p class="sub">No places match “${esc(searchText)}”. Try part of the name, like “riv”.</p>` : `<p class="sub">No places of this kind yet. Tap All to see every place.</p>`)}${!searchText && places.length > 8 ? `<button class="btn" data-act="uxall" style="width:100%;margin-top:8px">${uxAllPlaces ? "Show only the nearest" : `Show all ${places.length} places`}</button>` : ""}${(() => { const n = Object.keys(clearedLeft()).length; return `<button class="btn" data-act="tabgo" data-id="places" style="width:100%;margin-top:8px"> Locations: cleared places${n ? ` (${n})` : ""}</button>`; })()}</div>
      <p class="sub status ${Store.online ? "live" : ""}" style="margin-top:12px"><i></i>${Store.mode === "p2p" ? `The world · ${Store.peers ? `${Store.peers} other ${Store.peers === 1 ? "phone" : "phones"} online` : "looking for friends…"}` : Store.online ? `Shared world · ${others.length} other ${others.length === 1 ? "traveller" : "travellers"}` : APP ? "Offline game · saved on this phone" : "Saved in this browser only"}</p>${Store.online ? "" : onlineBtn()}</div>`;
  }

  function panelHero() {
    const need = 0 + (S.level + 3) * 25;
    const lvl = S.pendingLevels > 0 && typeof LEVELUP !== "undefined" ? LEVELUP.promptHTML(S) : S.pendingLevels > 0 ? `<div class="panel" style="border-color:var(--gold)"><h2>Level up!</h2><p class="sub">You have ${S.pendingLevels} level-up${S.pendingLevels > 1 ? "s" : ""} to spend. Skyrim rules: +10 to one attribute.</p>
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))"><button class="btn attrbtn" data-act="lvl" data-a="health">${UIART.attr("health", 26)} Health</button><button class="btn attrbtn" data-act="lvl" data-a="magicka">${UIART.attr("magicka", 26)} Magicka</button><button class="btn attrbtn" data-act="lvl" data-a="stamina">${UIART.attr("stamina", 26)} Stamina</button></div></div>` : "";
    const groups = Object.entries(D.SKILL_GROUPS).map(([g, list]) => `<h3 style="margin-top:14px">${esc(g)}</h3><div class="skills">${list.map((sk) => {
      const s = S.skills[sk], n = F.skillXpNeeded(sk, s.lvl);
      const bs = boost(sk);
      return `<button class="skill ${heroSkill === sk ? "on" : ""}" data-act="skinfo" data-id="${esc(sk)}" aria-expanded="${heroSkill === sk}"><small><span>${UIART.skill(sk, 20)} ${esc(sk)}${typeof LEGEND !== "undefined" && LEGEND.stars(S, sk) ? ` <b class="leg-stars">${LEGEND.starText(LEGEND.stars(S, sk))}</b>` : ""} <i class="sk-i">ⓘ</i></span><b class="num">${skillNum(sk)}</b></small><div class="bar"><i style="width:${pct(s.xp, n)}%;background:var(--frost)"></i></div>${bs.any ? `<small class="boost-t">${esc(bs.text)}</small>` : ""}</button>${heroSkill === sk ? `<div class="skcard">${skillInfoHTML(sk)}</div>` : ""}`;
    }).join("")}</div>`).join("");
    const pts = PERKS.pointsLeft(S);
    const skillsWithPerks = Object.keys(PERKS.TREES);
    perkSkill = perkSkill && skillsWithPerks.includes(perkSkill) ? perkSkill : skillsWithPerks.slice().sort((a, b) => S.skills[b].lvl - S.skills[a].lvl)[0];
    const perks = `<p class="sub">One perk point per level, like Skyrim. Pick a skill:</p>
      <div class="chips" style="flex-wrap:wrap">${skillsWithPerks.map((k) => { const n = PERKS.TREES[k].filter(([id]) => PERKS.rank(S, id)).length; return `<button class="chip ${k === perkSkill ? "on" : ""}" data-act="pskill" data-id="${esc(k)}">${esc(k)} ${S.skills[k].lvl}${n ? ` · ${n}` : ""}</button>`; }).join("")}</div>
      <p class="sub perk-sum">${UIART.skill(perkSkill, 32)} ${esc(SKILLINFO.summary(perkSkill))} <button class="linkbtn" data-act="skinfo" data-id="${esc(perkSkill)}">How to raise it</button></p>
      <div class="list" style="margin-top:8px">${PERKS.TREES[perkSkill].map(([id, name, ranks]) => {
        const r = PERKS.rank(S, id), p = PERKS.BY_ID[id], err = PERKS.canTake(S, id);
        return `<div class="item ${r ? "on" : ""}" style="flex-wrap:wrap">${UIART.skill(perkSkill, 26)}<div class="t">${esc(name)}${ranks > 1 ? ` <span class="num">${r}/${ranks}</span>` : r ? " ✓" : ""}<span>${esc(PERKS.nowText(S, id))}${r < ranks ? ` · needs ${esc(perkSkill)} ${p.req[r]}${p.needs.length ? ` and ${p.needs.map((n) => esc(PERKS.BY_ID[n].name)).join(" or ")}` : ""}` : ""}</span></div>
          ${r < ranks ? `<button class="btn sm ${err ? "" : "pri"}" data-act="perk" data-id="${id}" ${err ? "disabled" : ""}>Take</button>` : ""}</div>`; }).join("")}</div>`;
    const t = G.now(), fx = (S.fx || []).filter((f) => f.until > t);
    const gfx = gearFx();
    const effects = fx.length || gfx.length || G.rested(S) || S.poison ? `<div class="list">${gfx.map((g) => `<div class="item"><div class="t">${esc(fxLabel(g))}<span>from ${esc(g.from)} (while worn)</span></div></div>`).join("")}${G.rested(S) ? `<div class="item"><div class="t">${(S.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested"}<span>Skills improve ${Math.round((S.restBonus || 0.05) * 100)}% faster · ${Math.ceil((S.rested - t) / 60)} min left</span></div></div>` : ""}
      ${S.poison ? `<div class="item"><div class="t">${esc(S.poison.name)} on your weapon<span>${S.poison.hits} hit${S.poison.hits > 1 ? "s" : ""} left</span></div></div>` : ""}
      ${fx.map((f) => `<div class="item"><div class="t">${esc(f.name)} ${f.mag}<span>${Math.ceil((f.until - t) / 60)} min left</span></div></div>`).join("")}</div>` : "";
    const tnow = G.now(), rp = POWERS.RACE[S.race];
    const cd = (at) => { const m = Math.ceil(((at || 0) + POWERS.DAY - tnow) / 60); return m > 0 ? `ready in ${m} min` : "ready"; };
    const shoutRows = Object.entries(POWERS.SHOUTS).filter(([, [, words]]) => words.some((w) => POWERS.known(S, w))).map(([id, [name, words, cds, desc]]) => {
      const lv = POWERS.level(S, id);
      return `<div class="item" style="flex-wrap:wrap">${UIART.shout(id, 30)}<div class="t">${esc(name)} <span class="num">${words.map((w) => POWERS.known(S, w) ? (POWERS.unlocked(S, w) ? `<b>${w}</b>` : `${w}\uE117`) : "···").join(" ")}</span><span>${esc(desc)}${lv ? ` · cooldown ${typeof SHOUTS !== "undefined" ? SHOUTS.cd(S, id, lv) : cds[lv - 1]} s` : ""}</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${words.filter((w) => POWERS.known(S, w) && !POWERS.unlocked(S, w)).map((w) => `<button class="btn sm" data-act="unlock" data-id="${w}" ${(S.souls || 0) > 0 ? "" : "disabled"}>Unlock ${w} (1 soul)</button>`).join("")}
        ${(typeof SHOUTS !== "undefined" ? SHOUTS.outside(id) : POWERS.ROAD_SHOUTS.includes(id)) && lv ? `<button class="btn sm pri" data-act="roadshout" data-id="${id}" ${POWERS.voiceReady(S) ? "" : "disabled"}>Shout</button>` : ""}</div></div>`; }).join("");
    const fol = typeof FOLTAB !== "undefined" ? (S.follower || S.pet ? `<div class="panel ft-sum">${FOLTAB.summary(S, esc)}</div>` : "") : typeof FOL2 !== "undefined" ? FOL2.panel(S, esc) : S.follower ? `<div class="panel"><h2>Follower</h2><div class="item">${NPCART.follower(S.follower.id, 36)}<div class="t">${esc(TOWNS.FOLLOWERS[S.follower.id][0])}<span>${Math.round(TOWNS.followerHp(S))}/${TOWNS.followerMax(S, S.follower.id)} health · fights beside you · carries 100 for you · goes down instead of dying</span></div><button class="btn sm" data-act="dismiss">Dismiss</button></div></div>` : "";
    const powersHtml = `<div class="list">
      <div class="item">${UIART.power(S.race, 30)}<div class="t">${esc(rp[0])} <span class="num">${cd(S.powerAt)}</span><span>${esc(rp[1])} Once a day, from the Magic menu (Powers).</span></div></div>
      <div class="item">${S.stone ? UIART.stone(S.stone, 30) : ""}<div class="t">${S.stone ? esc(POWERS.STONES[S.stone][0]) : "No standing stone"}${S.stone && POWERS.stoneHasPower(S) ? ` <span class="num">${cd(S.stonePowerAt)}</span>` : ""}<span>${S.stone ? esc(POWERS.STONES[S.stone][1]) : "Visit one of the 13 standing stones (Guardian Stones are near Riverwood) to take its blessing."}</span></div></div>
      ${shoutRows || `<p class="sub">No Words of Power yet. Word Walls wait at the end of Nordic barrows (Bleak Falls Barrow has one), and the Greybeards at High Hrothgar teach Unrelenting Force.</p>`}</div>
      <p class="sub" style="margin-top:8px">Dragon souls: <b>${S.souls || 0}</b>${S.dragons ? ` · dragons slain: ${S.dragons}` : ""}. Kill a dragon to absorb its soul; each soul unlocks one word.${!POWERS.voiceReady(S) ? ` Your voice recovers in ${Math.ceil(S.voiceAt - tnow)} s.` : ""}</p>`;
    const amN = typeof AMMO !== "undefined" ? AMMO.status(S) : null;
    /* [menus2] one hero card on top, then sections that fold away (Skills and Perks have their own tabs too) */
    const fold = typeof MENUS2 !== "undefined" ? MENUS2.fold : (id, title, html) => `<div class="panel"><h2>${title}</h2>${html}</div>`;
    const fp = placesFound();
    const card = `<div class="panel m2-hero"><h2>${esc(S.name)}</h2><div class="m2-herogrid"><div class="herobox">${typeof AVATAR !== "undefined" ? AVATAR.hero(S, HEROART.figure(S, 160, 220), true) : HEROART.figure(S, 160, 220)}</div><div class="m2-herotxt">
      ${(S.titles || []).length ? `<p class="sub m2-titles">${S.titles.map(esc).join(" · ")}</p>` : ""}<p class="sub">Level ${S.level} ${esc(D.RACES[S.race].name)} · ${esc(D.RACES[S.race].desc)}</p><p class="sub"> Places discovered: <b>${fp.got}</b> of ${fp.all}${S.horse ? ` · Horse: ${esc(S.horse.name)}` : ""}</p>
      <div class="bar" style="margin-top:8px"><i style="width:${pct(S.charXp, need)}%;background:var(--gold)"></i></div><p class="sub num">${Math.round(S.charXp)}/${need} toward level ${S.level + 1}</p>
      <div class="grid2 m2-attrs"><div class="slot">Health<b class="num">${G.maxHealth(S)}</b></div><div class="slot">Magicka<b class="num">${G.maxMagicka(S)}</b></div><div class="slot">Stamina<b class="num">${G.maxStamina(S)}</b></div></div>
      <div class="m2-links"><button class="btn sm" data-act="tabgo" data-id="stars">Skills</button><button class="btn sm" data-act="tabgo" data-id="perks">Perks${pts > 0 ? ` · ${pts}` : ""}</button><button class="btn sm" data-act="tabgo" data-id="stats">Stats</button></div></div></div>${amN?.best ? ammoNote() : ""}</div>`;
    const start = `<details class="panel m2-wipe"><summary class="sub">Start over</summary><p class="sub">Deletes this character for good.</p><button class="btn danger" data-act="wipe">Delete ${esc(S.name)}</button></details>`;
    return `${charNav("hero")}${lvl}${card}${amN && !amN.best ? `<div class="panel" style="border-color:var(--ember)">${ammoNote()}</div>` : ""}${typeof LEGEND !== "undefined" ? fold("progress", "Progress", progressPanel(true)) : ""}${effects ? fold("effects", "Active effects", effects) : ""}${fol}`
      + fold("powers", "Powers & shouts", powersHtml, S.souls ? `<span>Dragon souls</span> <b class="num">${S.souls}</b>` : "")
      + fold("skills", "Skills", `${groups}<p class="sub" style="margin-top:14px">Skills rise as you use them, with Skyrim's own rates.</p>`)
      + fold("perks", `Perks${pts > 0 ? ` <span class="gold">· ${pts} to spend</span>` : ""}`, perks)
      + `${typeof RESPEC !== "undefined" ? RESPEC.panel(S) : ""}${typeof AFFL !== "undefined" ? AFFL.panel(S) : ""}${typeof BARGAIN !== "undefined" ? BARGAIN.panel(S) : ""}${bloodPanel()}${typeof MENUS !== "undefined" ? "" : achPanel()}${start}`;
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
    const canShop = S.location && G.shopTypes(S.location).length && (G.shopsOpen() || (typeof RUMOURS !== "undefined" && RUMOURS.knocked(S)));
    const enchanted = S.inv.filter((r) => D.ITEMS[r.item]?.enchant), gems = S.inv.filter((r) => D.ITEMS[r.item]?.slot === "soulgem");
    const row = (r) => {
      const it = D.ITEMS[r.item], open = packOpen === r.id, on = eqIds.has(r.id);
      const charge = typeof CHARGE !== "undefined" ? (CHARGE.info(r.item, r, S) ? ` · ${CHARGE.inline(r.item, r, S)}` : "") : it.enchant ? ` · ${Math.round(100 * (r.charge || 0) / it.enchant.capacity)}% charge` : it.staff ? ` · ${Math.round(100 * MAGIC.staffCharge(r) / it.staff.capacity)}% charge` : "";
      const acts = [];
      const onMain = on && !(G.loadout(S).equipment.offhand === r.id && G.loadout(S).equipment[it.slot] !== r.id);
      if (G.SLOTS.includes(it.slot)) acts.push(onMain ? `<button class="btn sm" data-act="uneq" data-slot="${it.slot}" data-id="${r.id}">Take off</button>` : `<button class="btn sm pri" data-act="eq" data-id="${r.id}">Equip</button>`);
      acts.push(offhandBtn(r, it, " sm"));
      if (it.slot === "tome") acts.push(`<button class="btn sm pri" data-act="read" data-id="${r.id}">Read</button>`);
      if (it.slot === "recipe") acts.push(`<button class="btn sm pri" data-act="cfread" data-id="${r.id}">Read</button>`);
      if (it.slot === "potion") acts.push(`<button class="btn sm pri" data-act="drinkrow" data-id="${r.id}">Drink</button>`);
      if (it.slot === "poison") acts.push(`<button class="btn sm pri" data-act="poison" data-id="${r.id}">Coat weapon</button>`);
      if (it.slot === "ingredient") acts.push(`<button class="btn sm" data-act="eat" data-id="${r.id}">Eat (learn an effect)</button>`);
      if ((it.enchant || it.staff) && gems.length) acts.push(...gems.map((g) => `<button class="btn sm" data-act="recharge" data-id="${r.id}" data-gem="${g.id}">Recharge (${esc(D.ITEMS[g.item].name.split(" (")[0])})</button>`));
      if (canShop && G.freeQty(S, r.id) > 0) acts.push(`<button class="btn sm" data-act="sell" data-id="${r.id}">Sell ${G.sellPrice(S, r)}g</button>`);   // worn gear is never sold
      if (typeof INVQOL !== "undefined") acts.push(...INVQOL.acts(S, r, on));   // Keep / Drop (invqol.js)
      const ingFx = it.slot === "ingredient" && TOWNS.INGREDIENT_FX[r.item] ? TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? e : "?").join(", ") : "";
      const qual = r.tq ? TOWNS.QUALITY[r.tq] + " " : "";
      return `<div class="item ${on ? "on" : ""}" data-act="packrow" data-id="${r.id}" style="flex-wrap:wrap">${ICONART.item(r.item, 34, r)}<div class="t">${esc(qual + it.name + (r.nm ? ` “${r.nm}”` : ""))}${r.qty > 1 ? ` ×${r.qty}` : ""}${on ? " ✓" : ""}${r.stolen ? ' <span class="danger-high">stolen</span>' : ""}${on ? "" : iqB(r.item, r)}<span>${ingFx && typeof GATHER !== "undefined" ? GATHER.fxHTML(S, r.item) : esc(ingFx || G.itemStats(r.item))}${r.temper ? ` · +${r.temper} improved` : ""}${r.mw && typeof CG !== "undefined" ? ` · ${CG.label(r.mw)} work` : ""}${charge} · ${+(it.weight * r.qty).toFixed(2)} wt</span></div>
        ${open ? `<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${acts.join("") || '<span class="sub">Nothing to do with this here.</span>'}</div>` : ""}</div>`;
    };
    return `<div class="panel"><h2>Equipped</h2>${dollScreen()}${typeof AMMO !== "undefined" && AMMO.status(S) && !AMMO.status(S).best ? ammoNote() : ""}
      <p class="sub" style="margin-top:8px">Carrying <span class="num">${G.carried(S).toFixed(1)}/${G.capacity(S)}</span>${G.overweight(S) ? " — too heavy to run" : ""} · ${S.gold} gold${enchanted.length ? ` · ${enchanted.length} enchanted` : ""}</p></div>
      <div class="panel"><h2>Pack</h2><p class="sub">Tap an item for options.${canShop ? " You're in town: you can sell here." : ""}</p>
      ${typeof INVQOL !== "undefined" && S.inv.length > 1 ? INVQOL.sortHTML(S) : ""}${S.inv.length > 6 ? `<input id="packsearch" class="uxsearch" type="search" placeholder=" Find an item" value="${esc(packSearch)}" autocomplete="off" aria-label="Find an item in your pack">` : ""}
      ${Object.entries(groups).map(([g, rows]) => [g, (typeof INVQOL !== "undefined" ? INVQOL.sorted(S, rows) : rows).filter((r) => !packSearch || ((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name).toLowerCase().includes(packSearch.toLowerCase()))]).filter(([, rows]) => rows.length).map(([g, rows]) => `<h3 style="margin-top:12px">${g}</h3><div class="list">${rows.map(row).join("")}</div>`).join("") || (packSearch ? `<p class="sub">Nothing called “${esc(packSearch)}”. Try part of the name.</p>` : '<p class="sub">Your pack is empty. Buy things in a town (Area tab → Shops) or loot them on the road.</p>')}</div>`;
  }

  // ------------------------------------------------------------ the newbie guide
  function guideHTML() {
    const pr = GUIDE.progress(S);
    return `<h2> Guide</h2><p class="sub">Your first hour in Skyrim, step by step. Steps tick off by themselves. ${pr.done} of ${pr.total} done.</p>
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
    if (to.shop) { if (S.location && G.shopTypes) { townShop = to.shop; townShopAt = S.location; } }
    if (to.tab === "social") socTab = "friends";
    renderTabs(); renderPanel(true);
    if (typeof MENUTOP !== "undefined") MENUTOP.top(); else $("#side").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    toast(` ${st[1]}: ${st[2]}`);
  }
  function guideCard() {
    const pr = GUIDE.progress(S); if (pr.done >= pr.total) return "";
    return `<div class="panel"><h2> Guide</h2><p class="sub">New here? ${pr.done} of ${pr.total} first steps done.</p><button class="btn pri" data-act="guide" style="width:100%">Open the guide</button></div>`;
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
    return `<p class="sub ammo ${a.best ? "" : "warn"}"> ${esc(a.text)}</p>`;
  }
  let horseCoat = "bay", horseBreed = "bay";
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
      const guards = g.length ? `<div class="cvguards">${g.map((d) => `<span>${typeof AVATAR !== "undefined" ? AVATAR.portrait(cardOf(d.uid) || { race: d.race || "nord", id: d.uid, name: d.name }, 26) : ""}${esc(d.name)} · ${d.level || 1}</span>`).join("")}</div>` : `<p class="sub" style="margin:4px 0">No guards yet.</p>`;
      const goods = c.here ? CARAVANS.stock(c).map((i) => `<div class="item${tiCls(i)}">${typeof ICONART !== "undefined" ? ICONART.item(i, 32) : ""}<div class="t">${esc(D.ITEMS[i].name)}<span>${esc(G.itemStats(i))}</span></div><span class="num gold">${CARAVANS.price(S, i)}</span><button class="btn sm" data-act="cvbuy" data-id="${esc(c.id)}" data-item="${esc(i)}" ${S.gold >= CARAVANS.price(S, i) ? "" : "disabled"}>Buy</button>${tiBox(i)}</div>`).join("") : "";
      return `<div class="card cvcard"><div class="cvhead">${CARAVANS.wagonHTML(110, 72, { khajiit: c.line.khajiit })}<div><h3 style="margin:0">${esc(c.line.name)}</h3><p class="sub" style="margin:2px 0 0">${c.here ? `To ${esc(c.to)} · leaves in ${cdSpan(c.depart)}` : `Arriving from ${esc(c.from)} in ${cdSpan(c.arrive)}`}</p></div></div>
        ${c.here ? `<p class="sub" style="margin:6px 0 0">Expect ${p.at.length === 2 ? "two ambushes" : "an ambush"} on the road. Pay: about <b class="gold">${sh.each}</b> gold each with ${sh.n} guard${sh.n > 1 ? "s" : ""} (more guards, bigger contract).</p>${guards}
          ${mine ? `<button class="btn" data-act="cvleave" style="width:100%">Leave the caravan</button>` : `<button class="btn pri" data-act="cvsign" data-id="${esc(c.id)}" style="width:100%" ${j || S.trip ? "disabled" : ""}>${j ? "You're guarding another caravan" : "Sign on as a guard"}</button>`}
          <h3 style="margin-top:10px">Wares</h3>${goods}` : ""}</div>`;
    }).join("");
  }
  function caravanJobPanel() {
    const j = S.caravanJob; if (!j) return "";
    const st = j.status === "signed" ? `Waiting in ${esc(j.from)}. The wagons leave in ${cdSpan(j.depart)} — be there.` : `On the road to ${esc(j.to)}. Arrives in ${cdSpan(j.arrive)}. ${j.ambush ? `Ambushes fought off: ${j.ambush}.` : "Stay sharp."}`;
    return `<div class="panel"><h2> Caravan job</h2><div class="cvhead">${CARAVANS.wagonHTML(84, 56, { khajiit: CARAVANS.LINES.find((x) => x.id === j.line)?.khajiit })}<div><b>${esc(j.name)}</b><p class="sub" style="margin:2px 0 0">${st}</p></div></div><button class="btn" data-act="cvleave" style="width:100%;margin-top:8px">Leave the caravan</button></div>`;
  }
  async function caravanPay() {
    const a = CARAVANS.arrived(S, guardDocs); if (!a) return;
    S.caravanJob = null;
    let paid = false;
    await Store.change("guards", a.recId, (d) => { const nd = CARAVANS.claim(d || { caravanId: a.recId.split("-").slice(0, 3).join("-"), uid: S.id, name: S.name }, a.pay); if (nd) paid = true; return nd || d; });
    if (!paid) { persist(true); return; }
    S.gold += a.pay; if (typeof CRISES !== "undefined" && WORLD.places[a.to]) CRISES.deed(S, G.holdAt(WORLD.places[a.to]), "escort");   // a safe caravan makes the hold safer (crises.js)
    persist(true); SOUND.fx("coin");
    showMessage("Caravan", ` ${a.name} rolls safely into ${a.to}. The caravan master counts out your share: ${a.pay} gold${a.n > 1 ? ` (${a.n} guards)` : ""}.`);
  }
  function stablesHTML(open, wanted) {
    const h = HORSES.fix(S), l = S.location;
    const swatch = (c, on, act) => `<button class="coat ${on ? "on" : ""}" ${act ? `data-act="hcoat" data-id="${c[0]}"` : "disabled"} style="background:${c[2]}" aria-label="${esc(c[1])}" aria-pressed="${on}"></button>`;
    const statRow = (st) => `<span class="hstats"><b> ${(+st.speed).toFixed(2)}×</b><b> ${Math.round(st.carry)}</b><b> ${Math.round(st.hp)}</b></span>`;
    if (!h) {
      const br = HORSES.breed(horseBreed), bp = HORSES.price(S, horseBreed);
      return `<div class="card"><h3>Buy a horse · ${bp} gold</h3><p class="sub">Riding, you travel faster and flee more easily. Your horse carries things for you even when you walk beside it. Horses never die: at 0 health they are downed. A downed horse stays with you and still carries your things, but you can't ride it until it gets back up (a few hours, a night's sleep, or a stablehand's care).</p>
      <div class="hbreeds">${Object.entries(HORSES.BREEDS).map(([id, b]) => `<button class="hbreed ${id === horseBreed ? "on" : ""}" data-act="hbreed" data-id="${id}" aria-pressed="${id === horseBreed}"><b>${esc(b.name)}</b><span class="num gold">${HORSES.price(S, id)}</span>${statRow(b)}<small>${esc(b.text)}</small></button>`).join("")}</div>
      <p class="sub" style="margin:6px 0 2px">Every horse is a little different: its numbers can come out up to ${Math.round(HORSES.ROLL * 100)}% better or worse than its breed's.</p>
      <div class="coats">${HORSES.COATS.map((c) => swatch(c, c[0] === horseCoat, true)).join("")}</div><div class="hcoatrow">${typeof HORSEART !== "undefined" ? HORSEART.card(horseCoat, 120) : ""}<p class="sub" style="margin:4px 0 0">${esc(HORSES.coat(horseCoat)[1])}</p></div>
      <div class="chatrow"><input id="hname" maxlength="16" placeholder="Name your horse" autocomplete="off" aria-label="Horse name"><button class="btn pri" data-act="hbuy" ${open && !wanted && S.gold >= bp ? "" : "disabled"}>Buy ${esc(br.name)}</button></div>
      ${!open ? `<p class="sub">The stables open at 08:00.</p>` : S.gold < bp ? `<p class="sub">You have ${S.gold} gold.</p>` : ""}</div>`;
    }
    const c = HORSES.coat(h.coat), mh = HORSES.maxHp(h), hp = HORSES.hp(S), dn = HORSES.downed(S);
    const mins = Math.ceil(HORSES.readyIn(S) / 60), hrs = Math.max(1, Math.round(mins / 5)), tp = HORSES.tendPrice(S);
    const armd = !!h.armor && h.armor !== "none";
    const pic = (typeof HORSEART !== "undefined" && HORSEART.card(h.coat, 160, dn ? "down" : "stand")) || UIART.horse(h.coat, 72, armd, dn);   // the painted horse in its coat, else the drawn head
    return `<div class="card hstab${dn ? " hdown" : ""}"><div class="hhead"><div class="hport${dn ? " down" : ""}" aria-hidden="true">${pic}</div><div class="hinfo"><h3>${esc(h.name)}${dn ? ` <span class="hdowntag">Downed</span>` : ""}</h3><span class="sub">${esc(HORSES.breed(h.breed).name)} · ${esc(c[1])} · ${esc(HORSES.ARMOR[h.armor].name)}</span>${statRow({ speed: HORSES.speed(S), carry: HORSES.carry(S), hp: mh })}</div></div>
        ${dn ? `<p>${esc(h.name)} is downed: they limp along beside you but can't be ridden. Back on their feet in about ${hrs} ${hrs === 1 ? "hour" : "hours"} (${mins} min), or after you sleep.</p>
          <button class="btn pri" data-act="htend" style="width:100%" ${open && S.gold >= tp ? "" : "disabled"}>Tend ${esc(h.name)} (${tp} gold)</button>`
        : `${hp < mh ? `<button class="btn sm" data-act="htend" style="float:right;margin-top:6px" ${open && S.gold >= tp ? "" : "disabled"}>Tend (${tp} gold)</button>` : ""}<div class="vital" style="margin-top:8px"><small><span>Health</span><span class="num">${Math.round(hp)}/${mh}</span></small><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--sp)"></i></div></div>`}
        <div class="chatrow" style="margin-top:8px"><input id="hname" maxlength="16" placeholder="New name" autocomplete="off" aria-label="New name"><button class="btn" data-act="hrename">Rename</button></div></div>
      ${typeof BONDS2 !== "undefined" ? BONDS2.horseHTML(S, esc) : ""}
      <h3 style="margin-top:12px">Saddlebags</h3>${HORSES.BAGS.map((b, i) => (b ? `<div class="item"><div class="t">${esc(b.name)}<span>carries ${b.carry} more</span></div><span class="num gold">${HORSES.cost(S, b.price)}</span><button class="btn sm" data-act="hbags" ${i !== h.bags + 1 || !open || S.gold < HORSES.cost(S, b.price) || wanted ? "disabled" : ""}>${i <= h.bags ? "Owned" : "Buy"}</button></div>` : "")).join("")}
      <h3 style="margin-top:12px">Horseshoes</h3>${Object.entries(HORSES.SHOES).filter(([id]) => id !== "none").map(([id, a]) => { const have = HORSES.SHOES[h.shoes].speed >= a.speed; return `<div class="item"><div class="t">${esc(a.name)}<span>ride ${Math.round(a.speed * 100)}% faster</span></div><span class="num gold">${HORSES.cost(S, a.price)}</span><button class="btn sm" data-act="hshoes" data-id="${id}" ${have || !open || S.gold < HORSES.cost(S, a.price) || wanted ? "disabled" : ""}>${h.shoes === id ? "Worn" : have ? "Have better" : "Buy"}</button></div>`; }).join("")}
      <h3 style="margin-top:12px">Horse armor</h3>${Object.entries(HORSES.ARMOR).filter(([id]) => id !== "none").map(([id, a]) => `<div class="item"><div class="t">${esc(a.name)}<span>+${a.hp} health · takes ${Math.round(a.guard * 100)}% less damage</span></div><span class="num gold">${HORSES.cost(S, a.price)}</span><button class="btn sm" data-act="harmor" data-id="${id}" ${h.armor === id || !open || S.gold < HORSES.cost(S, a.price) || wanted ? "disabled" : ""}>${h.armor === id ? "Worn" : "Buy"}</button></div>`).join("")}`;
  }
  /* [ux] Town sections in a few labelled groups, with a line on what the open one is for */
  const TOWN_GROUPS = [["Shops", ["general", "blacksmith", "wizard", "fence", "market", "stables"]], ["Services", ["inn", "train", "forge", "alchemy", "enchanter", "cook", "craft", "carriage", "hire"]],
    ["Your home", ["home", "homes", "homestead"]], ["Guilds & jobs", ["jobs", "notice", "hunts", "heist", "caravans", "hall", "mine", "streets"]], ["Fun", ["arena", "fish"]]];
  const TOWN_DESC = { general: "Buy food, potions and supplies; sell almost anything.", blacksmith: "Weapons, armor, arrows and metal.", wizard: "Spell tomes, staffs and soul gems.", fence: "Buys stolen goods.", market: "Things other players are selling.", stables: "Buy a horse or a cart to travel and carry more.",
    inn: "Sleep to heal and get Rested; hear rumours.", train: "Pay to raise a skill (5 times per level).", forge: "Make, smelt and improve gear.", alchemy: "Mix ingredients into potions.", enchanter: "Learn and add enchantments.", cook: "Cook meals that heal and buff.", craft: "Design your own spells.", carriage: "Safe, fast rides to other cities.", hire: "Hire a follower who fights beside you.",
    home: "Your house: a safe chest, a bed and a garden.", homes: "Visit other players' houses here.", homestead: "Land outside town: build your own house, stage by stage.", hunts: "The Jarl's contracts on legendary beasts, and your bestiary.", heist: "Rob a rich household: plan it, get in, grab the prize, get out.", jobs: "Small paid jobs: clear, deliver, gather.", notice: "This week's world goals and rewards.", caravans: "Guard a caravan for pay.", hall: "A hall everyone builds together.", mine: "Dig ore with a pickaxe.", streets: "Pickpocket, check your bounty, talk to guards.",
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
      if (l && WORLD.places[l]) townCtx = { l };   // locscreen.js: a place without shops (cave mouth, farm, stone...)
      if (l && (DUNGEONS.enterable(l) || POWERS.STONE_AT[l] || l === "High Hrothgar" || (typeof PLACESTUFF !== "undefined" && PLACESTUFF.offers(l).length))) return (typeof LEGHUNT !== "undefined" ? LEGHUNT.wildHTML(S, esc) : "") + placeHere();
      return (typeof LEGHUNT !== "undefined" ? LEGHUNT.wildHTML(S, esc) : "") + wildsFood() + `<div class="panel"><h2>${l ? esc(l) : "The wilds"}</h2><p class="sub">${l ? "There's nothing to buy here." : "You're out on the road."} Cities and towns have shops, inns, trainers, alchemy labs, forges and jobs.</p></div>`;
    }
    const open = G.shopsOpen() || (typeof RUMOURS !== "undefined" && RUMOURS.knocked(S, l)), wanted = TOWNS.wanted(S), hold = G.holdAt(WORLD.places[l]);   // knocked at night (rumours.js)
    const sections = [...types.filter((x) => x !== "stables"), ...(TOWNS.INNS[l] ? ["inn"] : []), ...(TOWNS.TRAINERS[l] ? ["train"] : []), "alchemy", ...(types.includes("blacksmith") || HALLS.hasForge(S, l) || (typeof HSROOMS !== "undefined" && HSROOMS.station(S, "forge")) ? ["forge"] : []), "jobs", "streets", ...(TOWNS.followersHere(S).length || l === "Whiterun" ? ["hire"] : []), ...(TOWNS.carriageFrom(l) ? ["carriage"] : []), ...(TOWNS.HOMES[l] ? ["home", "homes", "market"] : []), ...(SMITH.MINES[l] ? ["mine"] : []), ...(l === SPELLCRAFT.TOWN ? ["craft"] : []), ...(CARAVANS.stopsAt(l) ? ["caravans"] : []), ...(l === HALL.TOWN ? ["hall"] : []), ...(HALLS.plotHere(l) || hallDocs.some((d) => d.town === l) || S.hall?.town === l ? ["halls"] : []), "notice", ...(TOWNS.INNS[l] ? ["cook"] : []), ...(l === ARENA.TOWN ? ["arena"] : []), ...(COOK.waterNear(WORLD.places[l]) ? ["fish"] : []), ...(ENCH.hasEnchanter(l) || (typeof HSROOMS !== "undefined" && HSROOMS.station(S, "enchanter")) ? ["enchanter"] : []), ...(types.includes("stables") ? ["stables"] : []), ...(typeof SOL !== "undefined" ? SOL.sections(l) : []), ...(typeof HOMESTEAD !== "undefined" ? HOMESTEAD.sections(l) : []), ...(typeof LEGHUNT !== "undefined" ? LEGHUNT.sections(l) : []), ...(typeof HEISTS !== "undefined" ? HEISTS.sections(l) : []),...(typeof HUNTGAME !== "undefined" ? HUNTGAME.sections(l) : []), ...(typeof TOURNEYUI !== "undefined" ? TOURNEYUI.sections(l) : [])];
    const AU = typeof AREAUI !== "undefined" ? AREAUI : null;   // areaui.js: the Area tab opens on a board of grouped places
    if (AU && townShopAt !== l) { if (townShopAt != null) townShop = ""; townShopAt = l; }   // a new town opens on its board
    townShop = sections.includes(townShop) ? townShop : AU ? "" : sections[0];
    const names = { general: "General goods", blacksmith: "Blacksmith", wizard: "Court wizard", stables: "Stables", fence: "Ragged Flagon (fence)", inn: TOWNS.INNS[l] || "Inn", train: "Trainers", alchemy: "Alchemy lab", forge: "Forge", jobs: "Jobs", streets: "Streets", hire: l === "Whiterun" ? "Dragonsreach & hirelings" : "Hirelings", hall: "⚑ Hall of the North", halls: "\uE119 Halls & shops", notice: "\uE103 Jarl's bounty", homes: "\uE11C Neighbours", market: "\uE133 Market stalls", mine: "\uE12A Mine", craft: "\uE10A Spell crafting", caravans: "\uE13B Caravans", cook: "\uE148 Cooking pot", arena: "\uE101 The Arena", fish: "\uE146 Fishing", hunt: "\uE10C Hunting grounds", carriage: "Carriage", enchanter: "Arcane enchanter", home: TOWNS.home(S, l) ? `\uE11D ${TOWNS.HOMES[l]?.[0]}` : `Buy ${TOWNS.HOMES[l]?.[0]}`, ...(typeof SOL !== "undefined" ? SOL.NAMES : {}), ...(typeof HOMESTEAD !== "undefined" ? HOMESTEAD.names(S, l) : {}), ...(typeof TOURNEYUI !== "undefined" ? TOURNEYUI.names(S, l) : {}), ...(typeof LEGHUNT !== "undefined" ? LEGHUNT.names() : {}), ...(typeof HEISTS !== "undefined" ? HEISTS.names() : {}) };
    const news = [typeof CIVILWAR !== "undefined" ? CIVILWAR.townLine(S, l) : "", typeof HOLDUI !== "undefined" ? HOLDUI.townLine(S, l) : "", typeof CRISES !== "undefined" ? CRISES.townLine(S, l) : "", typeof TOURNEYUI !== "undefined" ? TOURNEYUI.townLine(S, l) : ""].filter(Boolean);
    const wantedLine = wanted ? `<p class="sub danger-high">You're wanted in ${esc(hold)}. Shops, inns and trainers turn you away.</p>` : "";
    const townTop = news.join("") + wantedLine;
    /* [stations] on a place's own page the town lines the board already shows fold into one "Town news (N)" row; being wanted stays in view */
    const newsRow = news.length ? `<div class="au-news${townNews ? " on" : ""}"><button class="au-newsb" data-act="townnews" aria-expanded="${townNews}"><span>Town news</span> <span class="au-nn">(${news.length})</span><span class="au-chev" aria-hidden="true">${townNews ? "▴" : "▾"}</span></button>${townNews ? `<div class="au-newsin">${news.join("")}</div>` : ""}</div>` : "";
    if (AU && !townShop) townCtx = { l, town: true, sections, names, open, hold, news, wanted: wantedLine, rumours: typeof RUMOURS !== "undefined" ? RUMOURS.townHTML(S, l, "", open) : "" };   // locscreen.js
    if (AU && !townShop) return `<div class="panel au-panel"><h2>${esc(l)}</h2>${PLACEART.scene(l)}${townTop}${typeof RUMOURS !== "undefined" ? RUMOURS.townHTML(S, l, "", open) : ""}${AU.hub({ S, l, sections, names, open, hold })}<p class="sub au-gold">You have <b class="gold">${S.gold} gold</b>.</p></div>`;
    const fac = F.priceFactor(G.skill(S, "Mercantile"));
    let body = "", note = "";
    const shopRow = (i, sell = true) => { const p = G.buyPrice(S, i), it = D.ITEMS[i], tome = it.slot === "tome" && !TI && typeof TOMES !== "undefined" ? ` · ${TOMES.level(it.spell)}${S.spells.includes(it.spell) ? " · you know it" : ""}` : ""; return `<div class="item${tiCls(i)}">${ICONART.item(i, 34)}<div class="t">${esc(it.name)}${iqB(i)}<span>${esc(G.itemStats(i))}${tome} · ${it.weight} wt</span></div>${econB(i)}<span class="num gold">${p}</span><button class="btn sm" data-act="buy" data-item="${esc(i)}" ${open && !wanted && S.gold >= p ? "" : "disabled"}>Buy</button>${it.slot === "ammo" ? (() => { const p20 = G.lotPrice ? G.lotPrice(S, i, 20, "buy") : p * 20; return `<button class="btn sm" data-act="buyn" data-item="${esc(i)}" data-n="20" title="${p20} gold" ${open && !wanted && S.gold >= p20 ? "" : "disabled"}>×20</button>`; })() : ""}${tiBox(i)}</div>`; };
    if (townShop === "stables") body = stablesHTML(open, wanted) + cartHTML(open, wanted);
    else if (["general", "blacksmith", "wizard", "fence"].includes(townShop)) {
      note = `${G.shopsOpen() ? "Shops are open." : open ? "Night prices." : `Shops are closed for the night. They open at 08:00 (${esc(G.clockText())}).`} At Mercantile ${G.skill(S, "Mercantile")} you buy at about ${(fac / G.haggle(S)).toFixed(2)}× value.${townShop === "fence" ? " The fence buys stolen goods." : ""}`;
      body = barterHTML(townShop, open, wanted, shopRow);
      if (townShop === "wizard" && l === "Whiterun" && !S.thaneWhiterun) body = `<div class="item">${NPCART.portrait(NPCART.who("Whiterun", "wizard"), 44)}<div class="t">Farengar, court wizard<span>Wants the Dragonstone from Bleak Falls Barrow. The Jarl rewards whoever brings it.</span></div><button class="btn sm pri" data-act="dragonstone" ${TOWNS.canDeliverDragonstone(S) ? "" : "disabled"}>Give it</button></div>` + body;   // players look for Farengar here, not under hirelings
    } else if (townShop === "inn") {
      note = "Sleep to heal fully and become Rested (skills improve 5% faster for 40 minutes; your own bed gives 10%). Buy a round and the locals talk." + (FEST.freeInn() ? "  New Life Festival: rooms are free!" : "");
      body = (S.vampire ? `<div class="item"><div class="t"> Feed on a sleeping traveller<span>Resets your hunger. Someone might wake up (bounty).</span></div><button class="btn sm danger" data-act="vfeed">Feed</button></div>` : "") + (FEST.freeInn() ? `<div class="item on"><div class="t"> The innkeeper's New Life gift<span>Once a day: a hot meal and a little gold</span></div><button class="btn sm pri" data-act="festgift">Take it</button></div>` : "") + `<div class="item"><div class="t">Rent a room<span>${G.rested(S) ? "You're already rested" : "Full health and Rested"}</span></div><span class="num gold">${TOWNS.roomPrice(S)}</span><button class="btn sm pri" data-act="inn" data-c="room" ${wanted ? "disabled" : ""}>Sleep</button></div>
        <div class="item"><div class="t">Buy a round, listen for rumours<span>Reveals ${G.P(S, "rumour_monger") ? "two places" : "a place"} you haven't found yet</span></div><span class="num gold">${TOWNS.rumourPrice ? TOWNS.rumourPrice(S) : G.P(S, "rumour_monger") ? 0 : TOWNS.RUMOUR}</span><button class="btn sm" data-act="inn" data-c="rumour">Listen</button></div>`;
      body += CHARGEN.barberRow(S);   // a new look for a few coins (chargen.js)
      body += bardHTML(l);
    } else if (townShop === "train") {
      const n = TOWNS.trainedThisLevel(S);
      note = `Skyrim rules: 5 sessions per level (${5 - n} left), and trainers stop at 50 (common), 75 (expert) or 90 (master).`;
      body = TOWNS.TRAINERS[l].map(([who, sk, lvl]) => { const c = TOWNS.trainCost(S, sk), cur = S.skills[sk].lvl, ok = cur < TOWNS.CAP[lvl] && n < 5 && S.gold >= c && !wanted;
        return `<div class="item">${NPCART.trainer(who, sk, 44)}<div class="t">${esc(who)}<span>${esc(sk)} ${cur} → ${cur + 1} · ${lvl} trainer (up to ${TOWNS.CAP[lvl]})</span></div><span class="num gold">${c}</span><button class="btn sm" data-act="train" data-id="${esc(who)}" ${ok ? "" : "disabled"}>Train</button></div>`; }).join("");
    } else if (townShop === "alchemy") {
      const ings = S.inv.filter((r) => D.ITEMS[r.item]?.slot === "ingredient");
      alchSel = alchSel.filter((id) => ings.some((r) => r.id === id));
      const ingsShown = CQ ? CQ.alchFilter(S, ings, alchSel) : ings;
      const knownFx = (r) => TOWNS.INGREDIENT_FX[r.item][1].filter((e, i) => TOWNS.known(S, r.item)[i]);
      const selRows = alchSel.map((id) => ings.find((r) => r.id === id));
      const knownShared = selRows.length >= 2 ? [...new Set(selRows.flatMap(knownFx))].filter((e) => selRows.filter((r) => knownFx(r).includes(e)).length >= 2) : [];
      note = `Pick two or three ingredients that share an effect. You only see effects you've discovered: eat ingredients or experiment. Alchemy ${G.skill(S, "Alchemy")}.`;
      body = (typeof HARVEST !== "undefined" ? HARVEST.orderHTML(S) : "") + (ings.length ? (CQ ? CQ.alchTop(S) : "") + ingsShown.map((r) => `<div class="item ${alchSel.includes(r.id) ? "on" : ""}" data-act="alch" data-id="${r.id}" role="button" tabindex="0"><div class="t">${alchSel.includes(r.id) ? "" : "☐"} ${esc(D.ITEMS[r.item].name)} ×${r.qty}${typeof HARVEST !== "undefined" ? HARVEST.tagHTML(S, r.item) : ""}<span>${typeof GATHER !== "undefined" ? GATHER.fxHTML(S, r.item) : TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? esc(e) : "?").join(", ")}</span></div></div>`).join("")
        + `<p class="sub" style="margin-top:8px">${selRows.length >= 2 ? (knownShared.length ? `Known shared effects: <b>${knownShared.map(esc).join(", ")}</b>` : "No shared effects you know of. Could be a discovery, or sludge.") : "Select ingredients above."}</p>
        <button class="btn pri" data-act="brew" style="width:100%" ${alchSel.length >= 2 ? "" : "disabled"}>Brew</button>${CQ ? CQ.alchBulk(S, selRows) : ""}`
        : '<p class="sub">You have no ingredients. Gather them on the road, in dungeons, or buy them at the general store and court wizard.</p>');
    } else if (townShop === "forge") {
      const ftabs = `<div class="chips" style="margin-bottom:8px">${[["make", " Make"], ["refine", " Smelt & tan"], ["improve", " Improve"]].map(([k, l2]) => `<button class="chip ${forgeTab === k ? "on" : ""}" data-act="ftab" data-id="${k}">${l2}</button>`).join("")}</div>`;
      if (forgeTab === "make") {
        note = `Make weapons, armor and jewellery from ingots, leather and gems. Better metals need Smithing perks. Smithing ${G.skill(S, "Smithing")}.`;
        const g = forgeGroup, ids = SMITH.byGroup(g);
        body = ftabs + `<div class="chips" style="margin-bottom:6px;flex-wrap:wrap">${SMITH.GROUPS.map(([k, l2]) => `<button class="chip ${g === k ? "on" : ""}" data-act="fgroup" data-id="${k}">${l2}${CQ ? CQ.groupCount(S, k) : ""}</button>`).join("")}</div>`
          + (SMITH.PERK_FOR[g] && !G.P(S, SMITH.PERK_FOR[g]) ? `<p class="sub"> Needs the ${esc(PERKS.BY_ID[SMITH.PERK_FOR[g]].name)} perk (Character → Perks → Smithing).</p>` : "")
          + (g === "found" && typeof CRAFTFAIR !== "undefined" ? CRAFTFAIR.foundNote(S, esc) : "")
          + (CQ ? CQ.bar(S, "smith", ids) : "") + (CQ ? CQ.order(S, "smith", ids) : ids).map((id) => { const i = SMITH.info(S, id), it = D.ITEMS[id];
            return `<div class="item${CQ ? " cqrow" : ""}">${ICONART.item(id, 34)}<div class="t">${esc(it.name)}${i.out > 1 ? ` ×${i.out}` : ""}<span>${esc(G.itemStats(id))}${["valuable", "ring", "amulet"].includes(it.slot) ? ` · worth ${it.value}` : ""}${i.xpMult != null && i.xpMult < 0.99 ? ` · ${Math.round(i.xpMult * 100)}% XP (made recently)` : ""}${i.needs && typeof CRAFTFAIR !== "undefined" && !CRAFTFAIR.knows(S, i.needs) ? " ·  recipe needed" : ""}</span><span>${i.mats.map(([m, n], k) => `<b class="${i.have[k] >= n ? "" : "miss"}">${n} ${esc(D.ITEMS[m].name)}</b> (${i.have[k]})`).join(" · ")}</span>${CQ ? CQ.status(S, "smith", id) : ""}</div>${CQ ? `<div class="cqbtns">${CQ.star(S, "smith", id, it.name)}` : ""}<button class="btn sm ${i.block ? "" : "pri"}" data-act="smake" data-id="${esc(id)}" ${i.block ? "disabled" : ""}>Make</button>${CQ ? CQ.qty(S, "smith", id) + "</div>" : ""}</div>`; }).join("");
      } else if (forgeTab === "refine") {
        note = "Smelt ore into ingots and tan pelts into leather. Ores come from mines; pelts from wolves, bears and sabre cats.";
        const rk = SMITH.REFINE.map((r, k) => String(k));
        body = ftabs + (CQ ? CQ.bar(S, "refine", rk) : "") + (CQ ? CQ.order(S, "refine", rk) : rk).map((ks) => { const k = +ks, i = SMITH.refineInfo(S, k);
          return `<div class="item${CQ ? " cqrow" : ""}"><div class="t">${i.kind === "smelt" ? "" : ""} ${i.n} ${esc(D.ITEMS[i.out].name)}<span>from ${esc(SMITH.matText(i.mats))} · you can make ${i.times}</span>${CQ ? CQ.status(S, "refine", k) : ""}</div>${CQ ? `<div class="cqbtns">${CQ.star(S, "refine", k, D.ITEMS[i.out].name)}<button class="btn sm ${i.times ? "pri" : ""}" data-act="srefine" data-id="${k}" ${i.times ? "" : "disabled"}>Once</button>${CQ.qty(S, "refine", k)}</div>` : `<button class="btn sm ${i.times ? "pri" : ""}" data-act="srefine" data-id="${k}" ${i.times ? "" : "disabled"}>Once</button><button class="btn sm" data-act="srefineall" data-id="${k}" ${i.times > 1 ? "" : "disabled"}>All</button>`}</div>`; }).join("");
      } else {
      note = `Each improvement uses one piece of the item's material (ingots, leather, firewood, moonstone or dwarven metal). Blacksmiths sell the common ones; dungeons hide the rest. Your Smithing (${G.skill(S, "Smithing")}) sets how far: every 20 points allows one more quality level.`;
      const rows0 = S.inv.filter((r) => TOWNS.temperInfo(S, r)), rows = CQ && CQ.onlyCan(S) ? rows0.filter((r) => CQ.can(S, "temper", r.id).n > 0) : rows0;
      body = ftabs + (CQ ? CQ.bar(S, "temper", rows0.map((r) => r.id)) : "") + rows.map((r) => { const i = TOWNS.temperInfo(S, r);
        return `<div class="item${CQ ? " cqrow" : ""}"><div class="t">${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}<span>${i.block ? esc(i.block) : `→ ${TOWNS.QUALITY[i.q + 1]} (+${i.per} ${D.ITEMS[r.item].slot === "weapon" ? "damage" : "armor"}) · uses 1 ${esc(D.ITEMS[i.ingot].name)} (you have ${i.have})`}${typeof CHARGE !== "undefined" && CHARGE.info(r.item, r) ? " · " + CHARGE.inline(r.item, r, S) : ""}</span></div>${CQ ? '<div class="cqbtns">' : ""}<button class="btn sm" data-act="temper" data-id="${r.id}" ${i.block ? "disabled" : ""}>Improve</button>${CQ ? CQ.qty(S, "temper", r.id, undefined, false) + "</div>" : ""}</div>`; }).join("") || '<p class="sub">Nothing to improve.</p>';
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
      note = `Water nearby: ${COOK.waterNear(WORLD.places[l])}. Cast, wait for the float to dip, then reel in while keeping the line in the safe band. Better rods (general store, forge) make it easier.`;
      body = fishCard();
    } else if (townShop === "hunt") {
      note = `Deer, elk, foxes and hares come down to the meadows here. Stalk one, shoot it, and skin it for meat, hides and trophies. A skinning knife keeps the hides whole; hides tan into leather at the forge.`;
      body = huntCard();
    } else if (townShop === "caravans") {
      note = "Caravans roll between the holds on a timetable everyone shares. Sign on as a guard while the wagons wait, travel with them, fight off the ambushes, and collect your pay on arrival.";
      body = caravansHTML(l);
    } else if (townShop === "craft") {
      note = "The College's spellwrights can bind effects from spells you know into a spell of your own. It costs a little more magicka than casting the parts on their own.";
      body = (typeof RUNECRAFT !== "undefined" ? RUNECRAFT.button(S) : "") + craftHTML();   // the Rune table (runecraft.js)
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
      const tiers = HALL.TIERS.map(([n, need, what], i) => `<div class="item ${i === pr.tier ? "on" : ""}"><div class="t">${i <= pr.tier ? "" : "○"} ${esc(n)}${need ? ` · ${need.toLocaleString()}` : ""}<span>${esc(what)}</span></div></div>`).join("");
      const chestOpen = pr.tier >= 2, left = HALL.CHEST_PER_DAY - HALL.takenToday(S);
      const putRows = G.handable(S).filter((r) => HALL.canDeposit(r)).slice(0, 15);
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
        body = `${typeof HOMEART !== "undefined" ? HOMEART.mine(S, l) : ""}<div class="item"><div class="t">Your bed<span>Full health and Well Rested (+10% skills for 40 min)</span></div><button class="btn sm pri" data-act="homebed">Sleep</button></div>
          ${CHARGEN.mirrorRow(S)}
          <div class="item"><div class="t">Garden<span>${TOWNS.gardenReady(S) ? "Ripe: harvest ingredients" : `Growing. Ready in ${Math.ceil(((h.garden || 0) + 7200 - G.now()) / 60)} min`}</span></div><button class="btn sm" data-act="harvest" ${TOWNS.gardenReady(S) ? "" : "disabled"}>Harvest</button></div>${typeof GATHER !== "undefined" ? GATHER.gardenHTML(S) : ""}
          ${(() => { const gs = myGifts().filter((g) => g.town === l); return gs.length ? `<h3 style="margin-top:12px"> Gifts at your door (${gs.length})</h3><div class="list">${gs.map((g) => `<div class="item on"><div class="t">From ${esc(g.fromName)}<span>${[g.gold ? `${g.gold} gold` : "", g.row && D.ITEMS[g.row.item] ? VISITS.itemName(g.row) + (g.row.qty > 1 ? ` ×${g.row.qty}` : "") : "", g.note ? `“${esc(g.note)}”` : ""].filter(Boolean).join(" · ")}</span></div><button class="btn sm pri" data-act="giftopen" data-id="${esc(g.id)}">Take in</button></div>`).join("")}</div>` : ""; })()}
          ${(() => { const st = MARKET.mine(stalls, S.id).filter((d) => d.town === l); return `<h3 style="margin-top:12px"> Your stall</h3><div class="item"><div class="t">${st.length ? `${st.length} thing${st.length > 1 ? "s" : ""} for sale<span>${esc(st.map((d) => MARKET.itemName(d.row)).slice(0, 3).join(", "))}${st.length > 3 ? "…" : ""}</span>` : "Nothing for sale<span>Sell things here even while you're away</span>"}</div><button class="btn sm" data-act="shop" data-id="market">Open stall</button></div>`; })()}
          <h3 style="margin-top:12px">Over the door</h3><div class="chatrow"><input id="motto" maxlength="${VISITS.MOTTO_MAX}" placeholder="A motto visitors will see" value="${esc(S.motto || "")}" autocomplete="off" aria-label="Motto"><button class="btn" data-act="motto">Carve</button></div>
          <h3 style="margin-top:12px">Chest</h3><p class="sub" style="margin-top:0">Put up to ${VISITS.SHOW_MAX} things in the display case for visitors to see.</p>${HSTASH.panel(S, esc, svgI)}`;
      }
    } else if (townShop === "enchanter") {
      const known = ENCH.known(S), gems = S.inv.filter((r) => D.ITEMS[r.item]?.slot === "soulgem");
      const breakable = S.inv.filter((r) => ENCH.isEnchanted(D.ITEMS[r.item]) && !Object.values(G.loadout(S).equipment).includes(r.id));
      const blanks0 = S.inv.filter((r) => { const it = D.ITEMS[r.item]; return ENCH.canBase ? ENCH.canBase(it) : (it.slot === "weapon" || G.ARMOR_SLOTS.includes(it.slot)) && !ENCH.isEnchanted(it); }), blanks = CQ ? CQ.enchBlanks(S, blanks0, known) : blanks0;
      enchDraft.item = blanks.some((r) => r.id === enchDraft.item) ? enchDraft.item : blanks[0]?.id;
      const bit = enchDraft.item != null ? D.ITEMS[G.invRow(S, enchDraft.item).item] : null;
      const fits0 = bit ? known.filter((e) => ENCH.canTake(bit, e)) : [], fits = CQ ? CQ.order(S, "ench", fits0, { keep: true }) : fits0;
      enchDraft.eff = fits.includes(enchDraft.eff) ? enchDraft.eff : fits[0];
      enchDraft.gem = gems.some((r) => r.id === enchDraft.gem) ? enchDraft.gem : gems[0]?.id;
      const pv = enchDraft.item != null && enchDraft.eff && enchDraft.gem != null ? ENCH.preview(S, enchDraft.item, enchDraft.eff, enchDraft.gem) : null;
      const effName = (e) => (ENCH.WEAPON[e] || ENCH.ARMOR[e])[0];
      note = `Break an enchanted item to learn its effect (the item is destroyed), then put it on your own gear with a filled soul gem. Stronger with a bigger soul and higher Enchanting (${G.skill(S, "Enchanting")}).`;
      body = (typeof RUNECRAFT !== "undefined" ? RUNECRAFT.button(S) : "") + `<h3>Effects you know</h3><p class="sub">${known.length ? known.map(effName).map(esc).join(", ") : "None yet. Find or buy enchanted gear and break it down here."}</p>
        <h3 style="margin-top:10px">Break down (learn)</h3>${breakable.length ? breakable.map((r) => `<div class="item"><div class="t">${esc(D.ITEMS[r.item].name)}<span>${known.includes(ENCH.effectOf(r.item)) ? "You know this effect already" : `Teaches ${esc(effName(ENCH.effectOf(r.item)))}`}${typeof CHARGE !== "undefined" && CHARGE.info(r.item, r) ? " · " + CHARGE.inline(r.item, r, S) : ""}</span></div><button class="btn sm" data-act="disench" data-id="${r.id}" ${known.includes(ENCH.effectOf(r.item)) ? "disabled" : ""}>Break</button></div>`).join("") : '<p class="sub">No loose enchanted items in your pack (take equipped ones off first).</p>'}${(() => {   // chargebar.js: weapons and staffs that aren't full, with their bar and a soul gem to fill them
          if (typeof CHARGE === "undefined") return "";
          const low = S.inv.filter((r) => { const x = CHARGE.info(r.item, r, S); return x && x.pct < 0.999; });
          if (!low.length) return "";
          const gtypes = [...new Map(gems.map((g) => [g.item, g])).values()];
          return `<h3 style="margin-top:10px">Recharge</h3>${low.map((r) => `<div class="item" style="flex-wrap:wrap">${ICONART.item(r.item, 30, r)}<div class="t">${esc(D.ITEMS[r.item].name)}<span>${CHARGE.inline(r.item, r, S)}</span></div>${gtypes.length ? gtypes.map((g) => `<button class="btn sm" data-act="recharge" data-id="${r.id}" data-gem="${g.id}">Recharge (${esc(D.ITEMS[g.item].name.split(" (")[0])})</button>`).join("") : '<span class="sub">No filled soul gem</span>'}</div>`).join("")}`;
        })()}
        <h3 style="margin-top:10px">Enchant</h3>${CQ ? CQ.enchBar(S) : ""}${blanks.length && known.length && gems.length ? `
          <label class="sub" for="ench_item">Item</label><select id="ench_item">${blanks.map((r) => `<option value="${r.id}" ${r.id === enchDraft.item ? "selected" : ""}>${esc(D.ITEMS[r.item].name)}</option>`).join("")}</select>
          <label class="sub" for="ench_eff">Effect</label>${CQ && enchDraft.eff ? CQ.star(S, "ench", enchDraft.eff, effName(enchDraft.eff)) : ""}<select id="ench_eff">${fits.length ? fits.map((e) => `<option value="${e}" ${e === enchDraft.eff ? "selected" : ""}>${esc(effName(e))}</option>`).join("") : '<option value="">Nothing you know fits this item</option>'}</select>
          <label class="sub" for="ench_gem">Soul gem</label><select id="ench_gem">${gems.map((r) => `<option value="${r.id}" ${r.id === enchDraft.gem ? "selected" : ""}>${esc(D.ITEMS[r.item].name)} ×${r.qty}</option>`).join("")}</select>
          <p class="sub" style="margin-top:6px">${pv ? `Result: ${esc(effName(enchDraft.eff))}. ${esc(ENCH.describe ? ENCH.describe(enchDraft.eff, pv.mag) : String(pv.mag))}${ENCH.WEAPON[enchDraft.eff] ? ` ${pv.cap} charge.` : ""}` : ""}</p>
          <button class="btn pri" data-act="enchant" style="width:100%" ${pv ? "" : "disabled"}>Enchant</button>`
          : CQ ? CQ.enchMissing(blanks.length, known.length, gems.length) : `<p class="sub">You need an unenchanted weapon, armor, ring or amulet, a known effect, and a filled soul gem (court wizards sell them).</p>`}`;
    } else if ((townShop === "festival" || townShop === "pit") && typeof TOURNEYUI !== "undefined") {
      ({ note, body } = TOURNEYUI.townHTML(S, townShop, l));
    } else if (townShop === "hunts" && typeof LEGHUNT !== "undefined") {
      ({ note, body } = LEGHUNT.townHTML(S, esc));
    } else if (townShop === "heist" && typeof HEISTS !== "undefined") {
      ({ note, body } = HEISTS.townHTML(S, esc));   // heists in the big cities (heists.js)
    } else if (townShop === "homestead" && typeof HOMESTEAD !== "undefined") {
      ({ note, body } = HOMESTEAD.townHTML(S, esc));
    } else if (townShop === "docks" && typeof SOL !== "undefined") {
      ({ note, body } = SOL.docksHTML(S, esc, { wanted }));
    } else if (townShop === "carriage") {
      note = "Skyrim fares: 20 gold to a big city, 50 to a small hold capital. The carriage goes as fast as a horse, and nothing attacks you on the way.";
      body = TOWNS.carriageDests(S).map(({ n, price }) => { const mins = G.pxDist(WORLD.places[l], WORLD.places[n]) * 1.15 / TOWNS.CARRIAGE_SPEED;
        return `<div class="item"><div class="t">${esc(n)}<span>about ${fmtMin(mins)}</span></div><span class="num gold">${price}</span><button class="btn sm pri" data-act="carriage" data-id="${esc(n)}" ${S.gold >= price && !wanted ? "" : "disabled"}>Ride</button></div>`; }).join("");
    } else if (townShop === "hire") {
      note = "One follower at a time. They fight beside you, carry 100 for you and heal between fights. Badly hurt, they go down and get back up after the fight; they never die. Hirelings cost 500 gold.";
      body = (l === "Whiterun" ? `<div class="item">${NPCART.portrait(NPCART.who("Whiterun", "wizard"), 44)}<div class="t">Farengar, court wizard<span>${S.thaneWhiterun ? "Thanks you again for the Dragonstone." : "Wants the Dragonstone from Bleak Falls Barrow. The Jarl rewards whoever brings it."}</span></div>${S.thaneWhiterun ? "" : `<button class="btn sm pri" data-act="dragonstone" ${TOWNS.canDeliverDragonstone(S) ? "" : "disabled"}>Give it</button>`}</div>` : "")
        + TOWNS.followersHere(S).map(([id, [name, , cost, hp, dmg, desc]]) => `<div class="item">${NPCART.follower(id, 36)}<div class="t">${esc(name)}<span>${esc(desc)} · ${TOWNS.followerMax(S, id)} health · hits for ~${Math.round(dmg * (1 + 0.05 * (S.level - 1)))}</span></div><span class="num gold">${cost || "free"}</span><button class="btn sm pri" data-act="hire" data-id="${id}" ${S.follower || S.gold < cost || wanted || (id === "lydia" && !S.thaneWhiterun) ? "disabled" : ""}>${S.follower?.id === id ? "With you" : "Hire"}</button></div>`).join("");
    } else if (townShop === "streets") {
      const b = TOWNS.bounty(S, hold);
      note = `Crime has a price: Skyrim bounties are 25 gold for pickpocketing, 40 for assault and 1000 for murder, per hold. Guards stop you when you come into a town where you're wanted.`;
      body = `<div class="item"><div class="t">Pick a pocket<span>Pickpocket ${G.skill(S, "Pickpocket")} · about ${Math.round(TOWNS.pickChance(S, { gold: 25, level: 10 }) * 100)}% chance · getting caught adds 25 gold bounty</span></div><button class="btn sm danger" data-act="pickpocket">Try</button></div>
        <div class="item"><div class="t">Your bounty in ${esc(hold)}<span>${b ? `${b} gold${wanted ? " · you resisted arrest: shops won't serve you" : ""}` : "Clean. For now."}</span></div>${b ? `<button class="btn sm" data-act="guardopen">Talk to a guard</button>` : ""}</div>
        <p class="sub" style="margin-top:8px">Stolen goods only sell to a fence: the Ragged Flagon in Riften, or anywhere with the Fence perk.</p>`;
    }
    let dayLine = "";
    if (typeof RUMOURS !== "undefined") { let rw = RUMOURS.townHTML(S, l, townShop, open);   // day and night, rumours, your name here
      if (AU) { const m = rw.match(/^<p class="rw-day">[\s\S]*?<\/p>/); if (m) { dayLine = m[0]; rw = rw.slice(m[0].length); } }   // [stations] the time-of-day line sits under the list
      body = rw + body; }
    if (typeof SOL !== "undefined") body += SOL.extraHTML(S, l, townShop, esc);   // Skaal smith's technique, Raven Rock's forge
    /* [stations] head → painting → who's here (one line) → the place's own tabs and list → how-it-works note */
    if (AU) return `<div class="panel au-panel au-in">${AU.head({ l, sections, names, cur: townShop, desc: TOWN_DESC[townShop] })}${wantedLine}${newsRow}
      ${(townShop === "home" && TOWNS.home(S, l)) || (townShop === "hall" && typeof HOMEART !== "undefined") || townShop === "halls" ? "" : PLACEART.section(townShop === "hire" ? "hall" : townShop === "cook" ? "inn" : townShop === "home" && TOWNS.home(S, l) ? "home" : townShop)}${typeof NPCART !== "undefined" ? NPCART.talk(l, townShop, S) : ""}<div class="list">${body}</div>${AU.note(note)}${dayLine}<p class="sub" style="margin-top:10px">You have <b class="gold">${S.gold} gold</b>.</p></div>`;
    return `<div class="panel"><h2>${esc(l)}</h2>${PLACEART.scene(l)}${townTop}
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
  /* the people side of the game (moved out of the Journal into  Friends): party, travellers, world, news, ladder, crimes */
  function socialBits() {
    const t = G.now(), me = livePos();
    const ppl = others.filter((o) => sameMap(o) && seesHero(o, t, true)).map((o) => ({ ...o, pos: otherPos(o, t) })).map((o) => ({ ...o, d: G.pxDist(me, o.pos) })).sort((a, b) => a.d - b.d);
    const inParty = (id) => party?.members.some((m) => m.id === id);
    const shared = Store.online;
    const partyHtml = !shared ? "" : `<div class="panel"><h2>Party${party ? ` · ${party.members.length}/${typeof PARTYPLAY !== "undefined" ? PARTYPLAY.MAX_PARTY : 8}` : ""}</h2>${party ? `<p class="sub">Led by ${esc(party.leaderName)}. The leader picks where to go and asks everyone "Ready?" before setting off; everyone with them follows at the slowest member's pace. The leader handles encounters on the road, members near them fight beside them, and the spoils are shared. Dungeons grow with the party.</p>
        <div class="list">${party.members.map((m) => `<div class="item" data-tip-k="player:${esc(m.id)}"><div class="t">${esc(m.name)}${typeof AFFL !== "undefined" ? AFFL.badge(m.id === S.id ? AFFL.cardBits(S).affl : cardOf(m.id)?.affl) : ""}${m.id === party.leader ? " ⚑" : ""}${m.id === S.id ? " (you)" : ""}<span>${m.id === S.id ? "" : (() => { const c = cardOf(m.id); return c ? `${esc(G.holdAt(otherPos(c)))} · ${G.pxDist(otherPos(c), me) <= MP.NEAR_PX ? "with you" : "away"}` : "offline"; })()}</span></div></div>`).join("")}</div>
        <button class="btn" data-act="leaveparty" style="width:100%;margin-top:8px">${party.leader === S.id ? "Disband the party" : "Leave the party"}</button>` : '<p class="sub">You travel alone. Invite someone from the list below.</p>'}
      ${invites.map((p) => `<div class="item on" style="margin-top:8px"><div class="t">${esc(p.leaderName)} invites you to their party<span>${p.members.length}/${typeof PARTYPLAY !== "undefined" ? PARTYPLAY.MAX_PARTY : 8} heroes</span></div><button class="btn sm pri" data-act="accept" data-id="${esc(p.id)}">Accept</button><button class="btn sm" data-act="decline" data-id="${esc(p.id)}">Decline</button></div>`).join("")}
      ${chests.map((c) => { const sh = MP.shareOf(c, S.id); return `<div class="item on" style="margin-top:8px;flex-wrap:wrap"><div class="t">\uE112 Party chest from ${esc(c.place)}<span>${c.goldLeft} gold${c.itemsLeft.length ? ", " + c.itemsLeft.map((i) => esc(D.ITEMS[i].name)).join(", ") : ""} · your fair share: ${sh.gold} gold${sh.items.length ? " + " + sh.items.length + " item" + (sh.items.length > 1 ? "s" : "") : ""}</span></div>
        <div style="display:flex;gap:6px;width:100%;flex-wrap:wrap">${c.taken.includes(S.id) ? '<span class="sub">You took your share.</span>' : `<button class="btn sm pri" data-act="share" data-id="${esc(c.id)}">Take my share</button>`}<button class="btn sm danger" data-act="grab" data-id="${esc(c.id)}">Take everything</button></div></div>`; }).join("")}</div>`;
    const canAmbush = shared && !S.trip && !S.location && !S.dungeon;
    const travellers = `<div class="panel"><h2>Travellers</h2>${shared
      ? (ppl.length ? `<div class="list">${ppl.map((o) => { const near = !MP.canTarget(S, o, me, o.pos), war = typeof SIDES !== "undefined" && !inParty(o.id) && SIDES.canAttack(S, o, { party, myPos: me, theirPos: o.pos }).mode === "war", os = typeof SIDES !== "undefined" ? SIDES.of(o.id) : null;
          return `<div class="item" style="flex-wrap:wrap">${typeof AVATAR !== "undefined" ? AVATAR.portrait(o, 44) : HEROART.portrait(o, 38)}${os ? `<span class="sideico" title="${esc(SIDES.LIST[os].name)}">${SIDES.emblem(os, 16)}</span>` : ""}<div class="t">${esc(o.name)}${inParty(o.id) ? " ⚑" : ""}<span>Level ${o.level} ${esc(D.RACES[o.race]?.name || "")}${typeof LEVELUP !== "undefined" ? LEVELUP.cardText(o) : ""} · ${esc(o.loc || G.holdAt(o.pos))}${o.moving ? " · travelling" : ""}${o.dungeon ? " · in a dungeon" : ""}${o.bounty ? ` · wanted (${o.bounty})` : ""}</span></div>
          <span class="num sub">${near ? "here" : o.d < 60 ? "nearby" : "~" + fmtMin(o.d * 1.1 / G.speed(S)) + " away"}</span>
          <div style="display:flex;gap:6px;width:100%;flex-wrap:wrap">${SOCIAL.isFriend(S, o.id) ? "" : `<button class="btn sm" data-act="fadd" data-id="${esc(o.id)}">＋ Friend</button>`}${inParty(o.id) ? `<span class="inparty">In your party</span>` : `<button class="btn sm" data-act="invite" data-id="${esc(o.id)}">Invite</button>`}
          ${near ? `<button class="btn sm" data-act="trade" data-id="${esc(o.id)}">Trade</button>` : ""}${near && !inParty(o.id) ? `<button class="btn sm" data-act="pick" data-id="${esc(o.id)}" ${MP.pickWait?.(S, o.id) ? `disabled title="Try again in ${Math.ceil(MP.pickWait(S, o.id) / 60)} min"` : ""}>Pickpocket</button>` : ""}${(near || war) && !inParty(o.id) ? `<button class="btn sm danger" data-act="attack" data-id="${esc(o.id)}">Attack</button>` : ""}</div></div>`; }).join("")}</div>
          <p class="sub" style="margin-top:8px">To rob someone you must be in the same place. Soldiers of rival sides (level 20+) can attack each other anywhere in the same hold. Fights use their gear and stats. Killing someone in a town is always seen; out in the wilds, sometimes.</p>`
        : `<p class="sub">No one else ${Store.mode === "p2p" ? "online right now. Send friends the app and they" : "yet. Share this page and friends"} appear here and on the map.</p>`)
      : APP ? `<p class="sub">This is the offline game: just you. Other players live in the online world.</p>${onlineBtn()}` : '<p class="sub">Shared saving isn\'t available in this view, so you\'re playing alone in this browser.</p>'}
      ${shared ? `<div class="item" style="margin-top:8px"><div class="t"> Lie in ambush<span>${S.ambush ? "Hidden by the road. The next traveller to pass close by gets a sneak attack." : canAmbush ? "Hide here off the road (you must be standing in the wilds). You're hidden from the map." : "Stop somewhere in the wilds first."}</span></div><button class="btn sm ${S.ambush ? "danger" : ""}" data-act="ambush" ${canAmbush || S.ambush ? "" : "disabled"}>${S.ambush ? "Stop" : "Hide"}</button></div>` : ""}</div>`;
    const bnt = Object.entries(S.bounty || {}).filter(([, v]) => v > 0);
    const bounty = bnt.length ? `<div class="panel"><h2>Bounties</h2><div class="list">${bnt.map(([h, v]) => `<div class="item"><div class="t">${esc(h)}<span>${v} gold${(S.resisted || {})[h] ? " · resisted arrest" : ""}</span></div></div>`).join("")}</div><p class="sub" style="margin-top:6px">Pay it to a guard in that hold's towns, or to a bounty hunter on the road.</p></div>` : "";
    const word = shared ? `<div class="panel"><h2>Word on the road</h2>${news.length ? `<div class="log">${news.slice(0, 20).map((n) => `<div><time>${new Date(n.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${esc(n.text)}</div>`).join("")}</div>` : '<p class="sub">Quiet, for now.</p>'}</div>` : "";
    const worldHtml = Store.mode === "p2p" ? `<div class="panel"><h2>The world</h2>
      <p class="sub">One world for everyone with the app, shared straight between phones. Only people online right now appear here. To bring a friend in, send them the app: github.com/R3MC10/Skyrim-Roads/releases</p>
      <div class="item"><div class="t">${Store.peers ? `${Store.peers} other ${Store.peers === 1 ? "player" : "players"} online` : "Looking for other players…"}<span>${Store.peers ? `${Store.direct} linked straight to you${Store.peers > Store.direct ? `, ${Store.peers - Store.direct} reached through other players or the backup line` : ""}` : "It can take up to a minute to find each other"}</span></div></div></div>` : "";
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
    return { party: partyHtml, people: travellers, crimes: bounty, news: word, world: worldHtml, ladder: ladderHtml };
  }

  // ------------------------------------------------------------ the Journal: quests only, like Skyrim's quest book
  let jTab = "active";
  const CURE_Q = new Set(["cure_vamp", "cure_wolf"]);
  /* which shelf of the Journal a quest sits on */
  function qCat(id) {
    if (id === "main") return "Main quest";
    if (id === "dragonborn") return "Solstheim";
    if (/^cw_/.test(id)) return "Civil War";
    if (/^dae_/.test(id)) return "Daedric";
    if (/^dg_/.test(id)) return "Dawnguard";   // dawnguard.js
    if (["companions", "thieves", "brotherhood", "college"].includes(id)) return "Guilds";
    if (CURE_Q.has(id) || /^cure_/.test(id)) return "Misc";
    return "Side quests";
  }
  const Q_ORDER = ["Main quest", "Solstheim", "Civil War", "Dawnguard", "Guilds", "Daedric", "Side quests"];
  function rewardHint(r) {
    if (!r) return "";
    const bits = [];
    if (r.gold) bits.push(`${r.gold} gold`);
    for (const it of r.items || []) bits.push(D.ITEMS[it]?.name || it);
    if (r.title) bits.push(`the title “${r.title}”`);
    return bits.length ? `Reward: ${bits.map(esc).join(", ")}` : "";
  }
  /* one quest in the book: emblem, giver, current objective with buttons, the stages so far */
  function questCard(id, v, done) {
    const def = QUESTS.L[id]; if (!def) return "";
    const tracked = !done && QUESTS.tracked(S)?.id === id;
    const stages = def.stages || [];
    const cur = done ? stages.length : Math.min(v.stage || 0, stages.length - 1);
    const st = done ? null : (QUESTS.active(S).find((a) => a.id === id)?.st || stages[cur]);
    const giver = def.giver ? `<span class="qgiver">${esc(def.giver)}</span>` : "";
    let obj = "";
    if (st) {
      const o = st.obj || {}, n = QUESTS.target(st), here = n && S.location === n, rec = QUESTS.recOf ? QUESTS.recOf(id, cur) : 0;
      const extra = `${o.count ? ` (${Math.max(0, ((S.stats || {})[o.count] || 0) - ((v.base || {})[o.count] || 0))}/${o.n})` : ""}${o.check ? ` · ${esc(o.check.skill)} check: ${Math.round(QUESTS.checkChance(S, o.check) * 100)}% chance${o.check.fight ? " (a fight if you're seen)" : o.check.bounty ? " (a bounty if you're seen)" : ""}` : ""}${(v.retryAt || 0) > G.now() ? ` · lie low ${Math.ceil((v.retryAt - G.now()) / 60)} more min` : ""}`;
      const btns = [o.talk && here ? `<button class="btn sm pri" data-act="qtalk" data-id="${id}">${esc(o.label)}</button>` : "",
        n && !here && WORLD.places[n] ? `<button class="btn sm pri" data-act="go" data-place="${esc(n)}">Go to ${esc(n)}</button>` : "",
        n && WORLD.places[n] ? `<button class="btn sm" data-act="qmap" data-place="${esc(n)}">Show on map</button>` : "",
        `<button class="btn sm ${tracked ? "on" : ""}" data-act="qtrack" data-id="${id}" aria-pressed="${tracked}">${tracked ? "★ Tracked" : "☆ Track"}</button>`].join("");
      obj = `<div class="qobj"><b>◆ ${esc(st.title)}</b><p>${esc(st.text)}${extra}</p>
        <p class="qmeta">${rec > 1 ? `<b class="qrec ${S.level < rec ? "low" : ""}">Recommended level ${rec}</b>` : ""}${rewardHint(st.reward) ? `<span class="qrew">${rewardHint(st.reward)}</span>` : ""}</p>
        <div class="qbtns">${btns}</div></div>`;
    }
    const past = stages.slice(0, cur).map((x) => `<li class="qdone">✓ ${esc(x.title)}</li>`).join("");
    const list = past || (!done && st) ? `<ol class="qstages">${past}${!done && st ? `<li class="qcur">▸ ${esc(st.title)}</li>` : ""}</ol>` : "";
    return `<div class="qcard qt-${typeof CC !== "undefined" ? CC.questType(id) : "side"} ${tracked ? "tracked" : ""} ${done ? "qcompleted" : ""}" id="q-${esc(id)}"><div class="qhead">${UIART.quest(id, 34)}<div class="t">${esc(def.name)}${tracked ? ' <span class="qstar" title="Tracked">★</span>' : ""}${giver}</div></div>${obj}${list}</div>`;
  }
  /* a non-story task in the same shape: icon, title, text, buttons */
  const miscCard = (icon, title, text, btns = "") => `<div class="qcard misc qt-misc"><div class="qhead"><span class="qico" aria-hidden="true">${icon}</span><div class="t">${title}</div></div><div class="qobj"><p>${text}</p>${btns ? `<div class="qbtns">${btns}</div>` : ""}</div></div>`;
  /* the signature of your quest progress: a dot on the Journal tab when it changes */
  const jSig = () => QUESTS.active(S).map((a) => `${a.id}:${a.stage}`).join(",");
  const journalNew = () => { try { return !!S && jSig() !== (S.jSeen ?? jSig()); } catch { return false; } };
  /* keeps the old #j-… ids on sections that moved, so links and bookmarks still find them */
  const idPanel = (id, h) => (h && /<div class="panel"/.test(h) ? h.replace(/<div class="panel"/, `<div id="j-${id}" class="panel"`) : `<div id="j-${id}">${h || ""}</div>`);
  /* where each section that used to be in the Journal lives now */
  const MOVED = { chat: ["social", "chat"], world: ["social", "chat"], news: ["social", "chat"], coop: ["social", "party"], party: ["social", "party"], people: ["social", "party"],
    trades: ["social", "trades"], holds: ["social", "realm"], clan: ["social", "faction"], faction: ["social", "faction"], ladder: ["social", "realm"], stats: ["stats"], crimes: ["stats"], finds: ["library"], log: ["diary"], cleared: ["places"],
    event: ["world"], rumours: ["world"], wev: ["world"], bounty: ["log", "misc"], caravan: ["log", "misc"], guide: ["log", "misc"], quests: ["log", "active"] };
  /* [journal] Character → Stats: lifetime stats, crime, discoveries and the library (moved out of the Journal) */
  const charNav = (cur) => typeof MENUS !== "undefined" ? "" : `<div class="seg charnav">${[["hero", "Character"], ["stats", "Stats"], ["diary", "Diary"]].map(([k, l]) => `<button class="${cur === k ? "on" : ""}" data-act="tabgo" data-id="${k}">${l}</button>`).join("")}</div>`;
  function panelStats() {
    const crimes = socialBits().crimes;
    return `${charNav("stats")}${idPanel("stats", typeof IMM !== "undefined" ? IMM.stats(S) : "")}${crimes ? idPanel("crimes", crimes) : ""}${typeof EXPLORE !== "undefined" && typeof MENUS === "undefined" ? idPanel("finds", EXPLORE.panel(S)) : ""}`;
  }
  function panelDiary() {
    return `${charNav("diary")}<div class="panel" id="j-log"><h2> Diary</h2><p class="sub">Everything that happened to you, newest first.</p><div class="log">${S.journal.map((j) => `<div><time>${new Date(j.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${esc(j.text)}</div>`).join("") || '<p class="sub">Nothing yet.</p>'}</div></div>`;
  }
  /* [journal] Map → Locations: cleared places and when they fill up again */
  function panelPlaces() {
    return `${typeof MENUS !== "undefined" ? "" : `<div class="panel"><button class="btn sm" data-act="tabgo" data-id="map">‹ Back to the map</button></div>`}${idPanel("cleared", clearedPanel() || '<div class="panel"><h2>Cleared locations</h2><p class="sub">You haven\'t cleared any place yet. Cleared dungeons show here with the time until they fill up again.</p></div>')}`;
  }
  function panelLog() {
    QUESTS.ensure(S);
    if (S.jSeen === undefined || tab === "log") S.jSeen = jSig();
    const act = QUESTS.active(S);
    const story = act.filter((a) => qCat(a.id) !== "Misc"), miscQ = act.filter((a) => qCat(a.id) === "Misc");
    const doneIds = Object.entries(S.quests || {}).filter(([id, v]) => v.done && QUESTS.L[id]).map(([id]) => id);
    // misc objectives: cures, guild work, the Jarl's bounty board, events, caravan jobs, treasure maps, the guide
    const work = ["thieves", "brotherhood"].filter((id) => GUILDS.canTake(S, id)).map((id) => {
      const st = GUILDS.state(S)[id], r = GUILDS.rank(S, id), j = st.job, who = id === "thieves" ? "Delvin and Vex" : "Nazir";
      const head = `${UIART.quest(id, 32)}<div class="t">${id === "thieves" ? "Thieves Guild work" : "Dark Brotherhood contracts"}<span>Rank: <b>${esc(r?.name || "—")}</b> · ${st.jobs} done${r?.next ? ` · ${esc(r.next[0])} at ${r.next[1]}` : ""}</span></div>`;
      if (j) { const here = S.location === j.town;
        return `<div class="item on qwork" style="flex-wrap:wrap">${head}<p class="sub" style="width:100%;margin:4px 0">${esc(j.label)}: ${esc(j.text)} Pays ${j.pay} gold. ${esc(j.skill)} check: ${Math.round(GUILDS.chance(S, j) * 100)}%.</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${here ? `<button class="btn sm pri" data-act="gdo" data-id="${id}">${id === "thieves" ? "Do the job" : "Fulfil the contract"}</button>` : `<button class="btn sm" data-act="go" data-place="${esc(j.town)}">Travel to ${esc(j.town)}</button>`}<button class="btn sm" data-act="gdrop" data-id="${id}">Drop it</button></div></div>`; }
      const at = GUILDS.takeAt(id).includes(S.location), wait = Math.max(0, st.next - G.now());
      return `<div class="item qwork" style="flex-wrap:wrap">${head}<p class="sub" style="width:100%;margin:4px 0">${wait > 0 ? `${who} will have more work in about ${Math.ceil(wait / 60)} min.` : at ? `${who} ${id === "thieves" ? "have" : "has"} work for you.` : `Ask ${who} for work ${id === "thieves" ? "in the Ragged Flagon (Riften)" : "at the Sanctuary (Falkreath or Dawnstar)"}.`}</p>${at && wait <= 0 ? `<button class="btn sm pri" data-act="gtake" data-id="${id}">${id === "thieves" ? "Ask for a job" : "Ask for a contract"}</button>` : ""}</div>`;
    }).join("");
    const maps = typeof EXPLORE !== "undefined" ? EXPLORE.openMaps(S).map((id) => { const m = EXPLORE.MAPS.find((x) => x[0] === id); return m ? miscCard("", esc(m[3]), `${esc(m[4])} The red X is on your map, near ${esc(m[1])}.`, WORLD.places[m[1]] ? `<button class="btn sm" data-act="qmap" data-place="${esc(m[1])}">Show on map</button>` : "") : ""; }).join("") : "";
    const avail = QUESTS.list().filter((id) => QUESTS.L[id].start && !(S.quests || {})[id] && (!QUESTS.visible || QUESTS.visible(S, id))).map((id) => {
      const d = QUESTS.L[id];
      return `<div class="item">${UIART.quest(id, 32)}${NPCART.giver(id, 32)}<div class="t">${esc(d.name)}<span>${QUESTS.canJoin(S, id) ? "They're here. Ask to join." : `Find them at ${esc(d.giver)}.`}</span></div>${QUESTS.canJoin(S, id) ? `<button class="btn sm pri" data-act="qjoin" data-id="${id}">Join</button>` : ""}</div>`;
    }).join("");
    const coopRun = coopUI && coopUI.card ? coopUI.card() : null;
    const sections = [
      ["Active", "active", story.length],
      ["Misc", "misc", miscQ.length + (work ? 1 : 0) + (maps ? 1 : 0)],
      ["Completed", "done", doneIds.length],
    ];
    const seg = `<div class="seg jseg" role="tablist">${sections.map(([l, k, n]) => `<button class="${jTab === k ? "on" : ""}" data-act="jtab" data-id="${k}" role="tab" aria-selected="${jTab === k}">${l}${n ? ` <b class="jbadge">${n}</b>` : ""}</button>`).join("")}</div>`;
    let body = "", after = "";
    if (jTab === "active") {
      const groups = Q_ORDER.map((c) => [c, story.filter((a) => qCat(a.id) === c)]).filter(([, l]) => l.length);
      body = groups.length ? groups.map(([c, l]) => `<h3 class="qcat">${esc(c)}</h3>${l.map((a) => questCard(a.id, a, false)).join("")}`).join("")
        : `<p class="sub">No active quests. Quest givers are listed below, and inns (Area tab) sell rumours.</p>`;
      if (coopRun && S.dungeon) body += `<h3 class="qcat">Co-op</h3>${miscCard("", `Co-op run: ${esc(S.dungeon.place)}`, `You're clearing ${esc(S.dungeon.place)} with your party, room by room. Open the Travel tab to carry on.`, `<button class="btn sm pri" data-act="tabgo" data-id="map">Carry on</button>`)}`;
      if (avail) body += `<h3 class="qcat">Quest givers</h3><div class="list">${avail}</div>`;
      body += `<p class="sub" style="margin-top:8px">☆ Track a quest to show it on the compass, the map's gold diamond and the “What to do next” card.</p>`;
    } else if (jTab === "misc") {
      body = [miscQ.map((a) => questCard(a.id, a, false)).join(""), work ? `<div class="list">${work}</div>` : "", maps].join("");
      const extra = [...(typeof MENUS !== "undefined" ? [] : [["rumours", typeof RUMOURS !== "undefined" ? RUMOURS.panel(S) : ""], ["wev", typeof WORLDEV !== "undefined" ? WORLDEV.journal() : ""], ["event", festPanel()]]), ["bounty", bountyPanel()], ["caravan", caravanJobPanel()], ["guide", guideCard()]].filter(([, h]) => h && h.trim()).map(([id, h]) => idPanel(id, h)).join("");
      body = body || (extra ? "" : `<p class="sub">No miscellaneous tasks right now.</p>`); after = extra;
    } else {
      body = doneIds.length ? doneIds.map((id) => questCard(id, S.quests[id], true)).join("") : `<p class="sub">Nothing finished yet.</p>`;
    }
    return `<div class="panel journal" id="j-quests">${seg}${body}</div>${after}`;
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
    if (/^snd_/.test(e.target.id || "")) return onSettingsInput(e);   // Character → Settings
    if (["cfAm", "cfBm", "cfName"].includes(e.target.id)) {
      if (e.target.id === "cfName") craftDraft.name = e.target.value; else { craftDraft[e.target.id === "cfAm" ? "am" : "bm"] = +e.target.value; const v = $("#" + e.target.id + "v"); if (v) v.textContent = e.target.value; }
      const pv = $("#cfPrev"); if (pv) pv.innerHTML = craftPreview(); return;
    }
    if (e.target.id === "cfA" || e.target.id === "cfB") { if (e.target.id === "cfA") { craftDraft.a = e.target.value; craftDraft.am = 0; } else { craftDraft.b = e.target.value; craftDraft.bm = 0; } renderPanel(true); return; } if (e.target.id === "chatin") { chatDraft = e.target.value; return; } if (e.target.id === "dmin") { dmDraft = e.target.value; return; } if (e.target.id === "versein") { verseDraft = e.target.value; return; }
    if (e.target.id === "socsearch") { socSearch = e.target.value; const pos = e.target.selectionStart; renderPanel(true); const q = $("#socsearch"); q.focus(); q.setSelectionRange(pos, pos); return; } if (e.target.id === "packsearch") { packSearch = e.target.value; const pos = e.target.selectionStart; renderPanel(true); const q = $("#packsearch"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } return; } if (e.target.id === "search") { searchText = e.target.value; const pos = e.target.selectionStart; renderPanel(true); const s = $("#search"); s.focus(); s.setSelectionRange(pos, pos); } }
  function onPanelChange(e) {
    const id = e.target.id;
    if (/^snd_/.test(id || "")) return onSettingsInput(e);
    if (id === "ench_item") { enchDraft.item = +e.target.value; renderPanel(true); }
    if (id === "ench_eff") { enchDraft.eff = e.target.value; renderPanel(true); }
    if (id === "ench_gem") { enchDraft.gem = +e.target.value; renderPanel(true); }
  }
  function onPanelClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const a = b.dataset.act, L = G.loadout(S);
    if (a.startsWith("coop") && coopUI) return void coopUI.act(b);
    if (/^loc(sheet|mode|leave)$/.test(a) && typeof LOCSCREEN !== "undefined") { SOUND.fx("click"); return void LOCSCREEN.act(b, { S, refresh: () => { townShop = ""; renderPanel(true); }, leave: () => { tab = "map"; bump(); renderTabs(); renderPanel(true); } }); }
    if ((a === "lvpick" || a === "lvsend") && lvUI) return void lvUI.act(b);
    if (/^pp(ready|go|cancel|kick|catch|vote|vhide)$/.test(a) && ppUI) return void ppUI.act(b);
    if (a.startsWith("cq") && CQ) return void CQ.act(S, b, { toast, openModal, closeModal, persist, renderPanel, tally, sound: (n) => SOUND.fx(n), guide: (k) => GUIDE.mark(S, k), selectMix: (ids) => { alchSel = ids; renderPanel(true); }, alchSel: () => alchSel });   // crafting shortcuts (craftqol.js)
    const say = (m) => { toast(m); persist(); renderPanel(true); if ($("#sky")) renderMenu(); };
    if (a && a.startsWith("dbg") && typeof BARGAIN !== "undefined") return void BARGAIN.act(S, b, { say, show: (t, m) => { persist(); renderPanel(true); showMessage(t, m); } });   // Daedric bargains: bind, ascend, refuse, break (bargains.js)
    if (a && a.startsWith("affl") && typeof AFFL !== "undefined") return void AFFL.act(S, b, { say, show: (t, m) => { persist(); renderPanel(true); showMessage(t, m); } });   // afflictions: cures and favours; the temple rites get a popup (afflictions.js)
    if (typeof INVQOL !== "undefined" && INVQOL.onClick(b, S, { say, openModal, closeModal, stall: (id) => stalls.find((d) => d.id === id),   // inventory helpers: Keep, junk, undo sale, confirms (invqol.js)
      render: () => { persist(); renderPanel(true); if ($("#sky")) renderMenu(); }, again: (ds) => { const x = document.createElement("button"); Object.assign(x.dataset, ds); onPanelClick({ target: x }); },
      sellMode: () => { shopMode = "sell"; renderPanel(true); }, heavyPack: () => { delete S.invSort; sky = { ...sky, page: "items", cat: "all", q: "", sel: null, sort: "weight", dir: 1 }; renderMenu(); } })) return;
    switch (a) {
      case "go": travelTo(b.dataset.place); renderPanel(true); break;
      case "uxall": uxAllPlaces = !uxAllPlaces; renderPanel(true); break;
      case "uxtab": tab = b.dataset.id; renderTabs(); renderPanel(true); if (typeof MENUTOP !== "undefined") MENUTOP.top(); else scrollTo(0, 0); break;
      case "uxhelp": uxHelpOpen = uxHelpOpen === b.dataset.id ? null : b.dataset.id; renderPanel(true); if ($("#sky")) renderMenu(); break;
      case "jfold": { const f = jFolds(); f[b.dataset.id] = !f[b.dataset.id]; try { localStorage.setItem("ux_jfold", JSON.stringify(f)); } catch { /* fine */ } renderPanel(true); break; }
      case "unpick": selected = null; roamSpot = null; renderPicked(); break;
      case "xsearch": case "xdig": case "xread": exploreAct(b.dataset.act, b.dataset.id); break;
      case "breach": if (typeof BLACKREACH !== "undefined") BLACKREACH.onClick(b); break;   // blackreach.js: the way down from Alftand / Raldbthar
      case "pstuff": if (typeof PLACESTUFF !== "undefined") PLACESTUFF.onClick(b, S, { toast, openModal, persist, renderPanel }); break;   // placestuff.js: something at every place
      case "gpick": case "gquick": case "hdeliver": case "gpickall": case "gforage": case "gauto": case "gplant": case "gunplant": case "gnotes": gatherAct(b.dataset.act, b.dataset.id); break;
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
      case "tradepick": { const id = +b.dataset.id; tradeSel = tradeSel.includes(id) ? tradeSel.filter((x) => x !== id) : [...tradeSel, id]; const c = cardOf(tradeTo) || (SOCIAL.isFriend(S, tradeTo) ? { id: tradeTo, name: SOCIAL.friends(S)[tradeTo].name } : null); if (c) openTrade(c); break; }
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
      case "skytab": if (sky.page !== b.dataset.id) sky.q = ""; sky.page = b.dataset.id; sky.cat = "all"; sky.sel = null; sky.sort = sky.page === "skills" ? "lvl" : "name"; sky.dir = 1; renderMenu(); break;
      case "skycat": sky.cat = b.dataset.id; sky.sel = null; renderMenu(); break;
      case "skysort": { const k = b.dataset.id; delete S.invSort; sky.dir = sky.sort === k ? -sky.dir : 1; sky.sort = k; renderMenu(); break; }
      case "favtoggle": { if (typeof FAVWHEEL === "undefined") break; const id = isNaN(+b.dataset.id) ? b.dataset.id : +b.dataset.id; const r = FAVWHEEL.toggle(S, id); toast(r.text); if (r.ok) persist(); renderMenu(); break; }
      case "skysel": { const id = isNaN(+b.dataset.id) ? b.dataset.id : +b.dataset.id; sky.sel = sky.sel === id ? null : id; renderMenu(); break; }
      case "skyclose": closeMenu(); break;
      case "skyperks": closeMenu(); perkSkill = b.dataset.id; tab = "hero"; bump(); renderTabs(); renderPanel(true); setTimeout(() => $("#side").scrollIntoView({ block: "start" }), 50); break;
      case "disench": say(ENCH.disenchant(S, +b.dataset.id)); break;
      case "enchant": { const d = { ...enchDraft }, ok = (ENCH.atEnchanter ? ENCH.atEnchanter(S) : ENCH.hasEnchanter(S.location)) && ENCH.preview(S, d.item, d.eff, d.gem);
        const go = (g) => { const m = CG.enchant(S, d.item, d.eff, d.gem, g); persist(true); renderPanel(true); showMessage("Arcane enchanter", m); publishCard(); };
        if (ok) CG.run("rune", { skill: G.skill(S, "Enchanting"), skillName: "Enchanting", what: `${ENCH.ARMOR[d.eff]?.[0] || ENCH.WEAPON[d.eff]?.[0] || ""} on ${D.ITEMS[G.invRow(S, d.item).item].name}` }, go); else go(CG.QUICK); break; }
      case "stone": say(POWERS.takeStone(S, b.dataset.id)); publishCard(); break;
      case "sail": { const err = SOL.sail(S); if (err) return toast(err); if (typeof IMM !== "undefined") IMM.loading(`${S.trip.ship[0].toUpperCase() + S.trip.ship.slice(1)} casts off for ${S.trip.destName}…`); SOUND.fx("coin"); persist(true); toast(` You set sail for ${S.trip.destName}. About ${fmtMin(S.trip.total)} at sea.`); tab = "map"; renderTabs(); renderPanel(true); break; }
      case "lhact": {   // legendary hunts (leghunt.js)
        const r = LEGHUNT.act(S, b.dataset.id, b.dataset.c); if (r.err) return toast(r.err); persist(true); renderPanel(true);
        if (r.event) { openEvent(); ppUI?.leaderHalt("event", r.title || "", S.trip?.event?.text || ""); } else if (r.title) showMessage(r.title, r.text); else if (r.text) toast(r.text);
        break;
      }
      case "hsact": {
        if (b.dataset.id === "defend") { const c = b.dataset.c; tbCall(() => HOMESTEAD.act(S, "defend", c), (r) => { if (r.err) return toast(r.err); persist(true); renderPanel(true); showFightResult(r); }); break; }   // a raid on your homestead (hsrooms.js)
        const r = HOMESTEAD.act(S, b.dataset.id, b.dataset.c); if (r.err) return toast(r.err); if (r.text) SOUND.fx(r.fx || "coin"); persist(true); renderPanel(true); if (r.title) showMessage(r.title, r.text); else if (r.text) toast(r.text); break; }
      case "solact": { const m = SOL.act(S, b.dataset.id); persist(true); toast(m); renderPanel(true); break; }
      case "carriage": { const err = TOWNS.rideCarriage(S, b.dataset.id); if (err) return toast(err); if (typeof IMM !== "undefined") IMM.loading(`The carriage rolls toward ${b.dataset.id}…`); S.trip.total = G.minutesLeft(S); persist(true); toast(`The driver cracks the reins. ${fmtMin(S.trip.total)} to ${b.dataset.id}.`); tab = "map"; renderTabs(); renderPanel(true); $("#mapwrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); follow = true; break; }
      case "hire": say(TOWNS.hire(S, b.dataset.id)); publishCard(); break;
      case "buyhome": { const m = TOWNS.buyHome(S); persist(true); renderPanel(true); showMessage("A home of your own", m); break; }
      case "homebed": say(TOWNS.sleepHome(S)); break;
      case "homejump": { const el = $("#homechest"); if (el) { const y = el.getBoundingClientRect().top + scrollY - 70; scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }); } break; }
      case "harvest": say(TOWNS.harvest(S)); break;
      case "stash": case "unstash": {   // house chest (homestash.js): data-n = how many ("amt" = the amount box), none = the whole row
        const id = +b.dataset.id, n = b.dataset.n === "amt" ? $("#hsAmt")?.value : b.dataset.n;
        const len0 = TOWNS.home(S)?.chest?.length || 0, m = a === "stash" ? TOWNS.stash(S, id, n) : TOWNS.unstash(S, id, n);
        if (typeof HSTASH !== "undefined") HSTASH.moved(S, a === "stash" ? "pack" : "chest", id, (TOWNS.home(S)?.chest?.length || 0) < len0 ? 0 : 1);
        say(m); publishCard(); publishHome(); break;
      }
      case "hstash2": HSTASH.act(S, b.dataset); renderPanel(true); break;
      case "dismiss": say(TOWNS.dismiss(S)); publishCard(); break;
      case "fol2": { const m = FOL2.act(S, b.dataset); persist(true); publishCard(); renderPanel(true); if (m) toast(m); break; }
      case "dragonstone": { const m = [TOWNS.deliverDragonstone(S), ...QUESTS.check(S)].join(" "); persist(true); renderPanel(true); showMessage("Dragonsreach", m); break; }
      case "greybeards": { const m = POWERS.greybeards(S); persist(true); renderPanel(true); showMessage("High Hrothgar", m); break; }
      case "unlock": say(POWERS.unlock(S, b.dataset.id)); break;
      case "roadshout": { SOUND.fx("shout"); const from = livePos(); const m = POWERS.roadShout(S, b.dataset.id); liveCache.key = ""; persist(true); toast(m); renderPanel(true);
        if (typeof FXART !== "undefined" && /^WULD/.test(m || "")) FXART.cast("whirlwind", { from }); break; }
      case "enter": { if (ppUI) { const pm = ppUI.beforeEnter(); if (pm === "check") { renderPanel(true); break; } if (pm) return toast(pm); } const err = DUNGEONS.enter(S); if (err) return toast(err); if (typeof IMM !== "undefined") IMM.loading(`Entering ${S.dungeon?.place || "the dungeon"}…`); selected = null; renderPicked(); dunNote = null; persist(true); renderDungeon(); break; }
      case "dun": renderDungeon(); break;
      case "ddtier": { const m = DEEPDELVE.pick(S, b.dataset.place, b.dataset.t); if (m) return toast(m); persist(); renderPanel(true); break; }   // deepdelve.js: Veteran / Legendary / Mythic
      case "droom": if (pvUI && pvUI.gate("way", b.dataset.c)) break; dungeonRoom(b.dataset.c); break;
      case "pvv": case "pvnow": if (pvUI) pvUI.act(b); break;
      case "dact": if (pvUI && pvUI.gate("act", b.dataset.c)) break; dunChoice(b.dataset.c); break;
      case "dmapjump": if (typeof DUNSTRIP !== "undefined") DUNSTRIP.jump($("#dun")); break;
      case "dmin": closeDungeon(); tab = "pack"; renderTabs(); renderPanel(true); break;
      case "dleave": { if (S.dungeon?.run && lvUI) { S.lastRun = S.dungeon.run; lvUI.leaderLeaving(); } if (S.dungeon?.run && coopUI) coopUI.left(); if (typeof IMM !== "undefined") IMM.loading("Back to the open road…"); const m = DUNGEONS.leave(S); dunNote = null; persist(true); closeDungeon(); renderPanel(true); showMessage("Back outside", m); break; }
      case "ev": if (b.dataset.c === "pick" && typeof IMM !== "undefined" && IMM.wantsGame()) { IMM.pick("event", eventAction, S); break; } eventAction(b.dataset.c); break;
      case "evbuy": { const ev = S.trip?.event, m = typeof WAGONS !== "undefined" && ev?.cid && /^cvmeet_/.test(ev.id || "") ? WAGONS.buy(S, ev, b.dataset.item) : G.buyFrom(S, b.dataset.item); persist(); openEvent(m); break; }
      case "enc": encounterAction(b.dataset.a); break;
      case "close": if (S?.pickTemple && typeof PVPDEATH !== "undefined") PVPDEATH.stay(S); closeModal(); break;
      case "pvptemple": toast(PVPDEATH.goTo(S, b.dataset.id)); persist(true); publishCard(); closeModal(); renderPanel(true); break;
      case "chatsend": chatSend($("#chatin")?.value); break;
      case "chatq": chatSend(b.dataset.id); break;
      case "chatch": chatCh = b.dataset.id; renderPanel(true); break;
      case "chatmute": { const m = chatMuted(), id = b.dataset.id; if (m.includes(id)) return; setPref("muted", [...m, id]); toast(`Muted ${b.dataset.name}. Their messages are hidden.`); onChat(chatRaw); renderPanel(true); break; }
      case "chatunmute": setPref("muted", []); toast("Everyone is unmuted."); onChat(chatRaw); renderPanel(true); break;
      case "pref": settingsAction("pref", b); if (b.closest("#side")) renderPanel(true); else openSound(); break;
      case "bk": bkClick(b); break;
      case "rename": {
        const n = ($("#myname")?.value || "").trim().slice(0, 24), bad = typeof NICK !== "undefined" ? NICK.problem(n) : n.length > 1 ? "" : "Pick a name.";
        if (bad) { toast(bad); break; }
        if (n !== S.name) { S.name = n; persist(true); renderTop(); toast(`You're now known as ${n}.`); }
        break;
      }
      case "totitle": Store.save(S); try { sessionStorage.setItem("rotn_open", "menu"); } catch { /* ignore */ } location.reload(); break;
      case "toupdate": Store.save(S); try { sessionStorage.setItem("rotn_open", "update"); } catch { /* ignore */ } location.reload(); break;
      case "lvl": say(G.levelUp(S, b.dataset.a)); publishCard(); break;
      case "lvlpick": if (typeof LEVELUP !== "undefined") LEVELUP.open(); break;
      case "respec": RESPEC.arm(b.dataset.a !== "off"); bump(); renderPanel(true); break;
      case "respecgo": RESPEC.arm(false); say(RESPEC.run(S)); publishCard(); bump(); renderPanel(true); break;
      case "wipe": Store.wipe().then(() => { S = null; tabsEl.classList.add("hide"); location.reload(); }); break;
      case "packrow": if (!e.target.closest("button")) { packOpen = packOpen === +b.dataset.id ? null : +b.dataset.id; renderPanel(true); } break;
      case "eq": say(G.equip(S, +b.dataset.id)); break;
      case "dollslot": SOUND.fx("click"); openModal(DOLL.picker(S, b.dataset.slot), "dsheet"); break;
      case "dolleq": { const m = G.equip(S, +b.dataset.id, b.dataset.slot); SOUND.fx(/^Equipped/.test(m) ? "equip" in (SOUND.FX || {}) ? "equip" : "clang" : "click"); if (/^Equipped/.test(m)) { closeModal(); publishCard(); } say(m); break; }
      case "dolloff": G.unequip(S, b.dataset.slot); closeModal(); publishCard(); say("Taken off."); break;
      case "uneq": G.unequip(S, (b.dataset.id && G.wornSlot && G.wornSlot(S, +b.dataset.id)) || b.dataset.slot); say("Taken off."); break;
      case "eqoff": { const m = G.equipOff(S, +b.dataset.id); if (/^Equipped/.test(m)) { SOUND.fx("clang"); publishCard(); } say(m); break; }   // dual wielding
      case "read": say(G.readTome(S, +b.dataset.id)); break;
      case "cfread": say(CRAFTFAIR.read(S, +b.dataset.id)); persist(true); renderPanel(true); break;
      case "cfname": { const inp = document.getElementById("cfname-" + b.dataset.id); say(CRAFTFAIR.rename(S, +b.dataset.id, inp ? inp.value : "")); persist(true); renderPanel(true); break; }
      case "drink": say(G.drinkPotion(S)); break;
      case "recharge": say(G.recharge(S, +b.dataset.id, +b.dataset.gem)); break;
      case "sell": { packOpen = null; const m = G.sell(S, +b.dataset.id, 1); if (/^Sold/.test(m)) GUIDE.mark(S, "trade"); say(m); break; }
      case "sellall": { const r = G.invRow(S, +b.dataset.id); if (r) { const m = G.sell(S, r.id, G.freeQty(S, r.id) || r.qty); if (/^Sold/.test(m)) GUIDE.mark(S, "trade"); say(m); } break; }
      case "smode": shopMode = b.dataset.id; renderPanel(true); break;
      case "shopcat": shopCat = b.dataset.id; SOUND.fx("click"); renderPanel(true); break;
      case "tradecat": { tradeCat = b.dataset.id; SOUND.fx("click"); const c = cardOf(tradeTo) || (SOCIAL.isFriend(S, tradeTo) ? { id: tradeTo, name: SOCIAL.friends(S)[tradeTo].name } : null); if (c) openTrade(c); break; }
      case "sbritual": say(SPELLBOOK.startRitual(S, b.dataset.id)); renderPanel(true); break;
      case "skytier": sky.tier = b.dataset.id; sky.sel = null; renderMenu(); break;
      case "skymsort": { const k = b.dataset.id; sky.mdir = (sky.msort || "name") === k ? -(sky.mdir || 1) : 1; sky.msort = k; renderMenu(); break; }
      case "m2dir": delete S.invSort; sky.dir = -(sky.dir || 1); renderMenu(); break;   // menus2.js: the ▲▼ sort toggle
      case "m2mdir": sky.mdir = -(sky.mdir || 1); renderMenu(); break;
      case "buy": { const m = G.buy(S, b.dataset.item, 1); if (/^Bought/.test(m)) GUIDE.mark(S, "trade"); say(m); break; }
      case "buyn": { const m = G.buy(S, b.dataset.item, +b.dataset.n || 1); if (/^Bought/.test(m)) GUIDE.mark(S, "trade"); say(m); break; }
      case "shop": { const fromHub = tab === "town" && !townShop && typeof AREAUI !== "undefined"; townShop = b.dataset.id; if (townShop === "halls") hallView = null; renderPanel(true); if (fromHub) $("#side .au-head")?.scrollIntoView({ block: "nearest" }); break; }
      case "townnews": townNews = !townNews; renderPanel(true); break;   // [stations] the folded town lines on a place's page
      case "areahub": townShop = ""; renderPanel(true); $("#side")?.scrollIntoView({ block: "start" }); break;   // areaui.js: back to the board
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
      case "bpick": if (typeof BEASTART !== "undefined") BEASTART.pick = BEASTART.pick === b.dataset.id ? null : b.dataset.id; renderPanel(true); break;
      case "bperk": { const [tr, id] = b.dataset.id.split(":"); const m = CURSE.takePerk(S, tr, id); persist(true); SOUND.fx(/: /.test(m) ? "levelup" : "click"); toast(m); renderPanel(true); break; }
      case "vfeed": say(CURSE.feed(S)); break;
      case "jtab": jTab = b.dataset.id; renderPanel(true); if (typeof MENUTOP !== "undefined") MENUTOP.top(); else scrollTo(0, 0); break;
      case "qtrack": { const id = b.dataset.id; S.trackQ = QUESTS.tracked(S)?.id === id && S.trackQ === id ? null : id; persist(); renderPanel(true); bump(); toast(S.trackQ ? `★ Tracking ${QUESTS.L[id]?.name || "the quest"}.` : "No quest tracked: the first active quest shows."); break; }
      case "qmap": { const n = b.dataset.place, p = WORLD.places[n]; if (!p) break; closeMenu?.(); tab = "map"; selected = n; follow = false; center = [p[0], p[1]]; if (zoom < 2) zoom = 2.4; renderTabs(); renderPanel(true); renderPicked(); bump(); scrollTo(0, 0); break; }
      case "tabgo": closeMenu?.(); tab = b.dataset.id; renderTabs(); renderPanel(true); bump(); if (typeof MENUTOP !== "undefined") MENUTOP.top(); else if (b.closest(".mn-sub")) $("#side").scrollIntoView({ block: "start" }); else scrollTo(0, 0); break;
      case "jgo": { const id = b.dataset.id, to = MOVED[id] || ["log", "active"]; closeMenu?.(); tab = to[0]; if (to[0] === "social") { socTab = to[1]; socWith = null; } if (to[0] === "log") jTab = to[1]; renderTabs(); renderPanel(true); bump(); requestAnimationFrame(() => { const el = $("#j-" + id); if (el) { const y = el.getBoundingClientRect().top + scrollY - 64; scrollTo({ top: y, behavior: "auto" }); } else scrollTo(0, 0); }); break; }
      case "festclaim": { const m = FEST.claim(S); if (!m) break; SOUND.fx("levelup"); say(m); publishCard(); break; }
      case "festgift": { const m = FEST.innGift(S); if (m) { SOUND.fx("coin"); say(m); } break; }
      case "clancol": clanDraft = { ...clanDraft, name: $("#clanname")?.value, tag: $("#clantag")?.value }; clanDraft.colors[+b.dataset.i] = b.dataset.id; renderPanel(true); break;
      case "clanfound": { const r = CLANS.found(S, $("#clanname")?.value, $("#clantag")?.value, clanDraft.colors); if (r.err) return toast(r.err); Store.put("clans", S.id, r.clan); CLANS.set([...CLANS.all.filter((x) => x.id !== S.id), { ...r.clan, id: S.id }], null); persist(true); postNews(` ${S.name} raised the banner of ${r.clan.name} [${r.clan.tag}].`); say(r.text); break; }
      case "claninv": { const c = myClan(); if (!c || c.founder !== S.id) break; const r = CLANS.invite(c, b.dataset.id); if (r.err) return toast(r.err); Store.put("clans", S.id, (({ id, ...x }) => x)(r.clan)); toast("Invitation sent."); break; }
      case "clankick": { const c = myClan(); if (!c || c.founder !== S.id) break; Store.put("clans", S.id, (({ id, ...x }) => x)(CLANS.kick(c, b.dataset.id).clan)); toast("They're no longer in the clan."); break; }
      case "clanjoin": clanJoin(b.dataset.id); invRefresh(); break;
      case "clanno": clanDecline(b.dataset.id); renderPanel(true); break;
      case "clanleave": { const c = myClan(); if (c && c.founder === S.id) { Store.remove("clans", S.id); postNews(`\uE13E The banner of ${c.name} was lowered.`); } say(CLANS.leave(S)); persist(true); break; }
      case "achmore": achOpen = !achOpen; renderPanel(true); break;
      case "guide": openGuide(); persist(); break;
      case "notes": openNotes(); break;
      case "guideno": S.guideOffered = true; persist(); renderPanel(true); toast("You can open the guide any time from  or the Journal."); break;
      case "guidego": guideGo(b.dataset.id); break;
      case "tutskip": S.tut = { ...S.tut, step: 0, off: true }; persist(); renderPanel(true); toast("Tutorial skipped. You can replay it from How to Play in the main menu."); break;
      case "tutseen": S.tut.seen = { ...(S.tut.seen || {}), [tab]: true }; persist(); renderPanel(true); break;
      case "pinicon": pinDraft.icon = b.dataset.id; { const v = $("#pinlabel")?.value || ""; openPinDialog(pinDraft.x, pinDraft.y); $("#pinlabel").value = v; } break;
      case "pinsave": { const id = addPin(pinDraft.x, pinDraft.y, $("#pinlabel")?.value, pinDraft.icon); closeModal(); if (id) { selected = "__pin:" + id; renderPicked(); SOUND.fx("click"); } break; }
      case "pindel": S.pins = (S.pins || []).filter((p) => p.id !== b.dataset.id); selected = null; renderPicked(); persist(); break;
      case "pinshare": { const p = (S.pins || []).find((q) => q.id === b.dataset.id); if (!p || !party) break; Store.put("chat", nid(), { from: S.id, name: S.name, text: `${p.icon} ${p.label}`, ch: party.id, t: G.now(), pin: { x: p.x, y: p.y, label: p.label, icon: p.icon } }); toast("Shared with your party in the chat."); break; }
      case "pinadd": { const d = chatDocs.find((x) => x.id === b.dataset.id); if (!d?.pin) break; const id = addPin(d.pin.x, d.pin.y, d.pin.label, d.pin.icon); if (id) { tab = "map"; renderTabs(); renderPanel(true); selected = "__pin:" + id; renderPicked(); follow = false; center = [d.pin.x, d.pin.y]; if (zoom < 2) zoom = 2.4; $("#mapwrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); } break; }
      case "duelstake": arenaStake = +b.dataset.id; if (typeof FASTQOL !== "undefined") FASTQOL.setMem("arenaStake", arenaStake); renderPanel(true); break;
      case "duelgo": { const c = others.find((o) => o.id === b.dataset.id); const r = ARENA.challenge(S, c && { ...c, id: c.id }, arenaStake); if (r.err) return toast(r.err); Store.put("duels", r.id, r.doc); persist(true); say(r.text); break; }
      case "duelyes": answerDuel(b.dataset.id, true); break;
      case "duelno": answerDuel(b.dataset.id, false); break;
      case "duelcancel": Store.change("duels", b.dataset.id, (d) => (d.status === "open" ? { ...d, status: "cancelled" } : d)); break;
      case "fishgo": GUIDE.mark(S, "fish"); openFishing(); break;
      case "huntgo": GUIDE.mark?.(S, "hunt"); openHunt(); break;
      case "huntroad": openHunt(true); break;
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
      case "hbuy": say(HORSES.buy(S, $("#hname")?.value, horseCoat, horseBreed)); publishCard(); break;
      case "hbreed": horseBreed = b.dataset.id; renderPanel(true); break;
      case "hbags": say(HORSES.buyBags(S)); break;
      case "hshoes": say(HORSES.buyShoes(S, b.dataset.id)); break;
      case "hrename": say(HORSES.rename(S, $("#hname")?.value)); break;
      case "harmor": say(HORSES.buyArmor(S, b.dataset.id)); break;
      case "htend": say(HORSES.tend(S)); publishCard(); break;
      case "hride": { const m = HORSES.toggle(S); liveCache.key = ""; S.trip && (S.trip.total = G.minutesLeft(S)); say(m); renderTrip(); publishCard(); if (typeof RIDING !== "undefined") RIDING.sync(S); break; }
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
        Store.put("verselikes", r.id, r.doc); if (!likeDocs.some((x) => x.id === r.id)) likeDocs.push({ ...r.doc, id: r.id }); SOUND.fx("click"); toast(` You cheer for ${v.name}'s verse.`); renderPanel(true); break; }
      case "bardsing": singSong(); break;
      case "barber": case "mirror": openLookChange(a); break;
      case "avatar": case "avall": openModal(AVATAR.sheet(S, a === "avall"), "avsheet"); break;   // [avatars] choose your portrait (avatar.js)
      case "avpick": { AVATAR.set(S, b.dataset.id); closeModal(); persist(true); publishCard(true); renderPanel(true); toast(AVATAR.chosen(S) ? "New portrait chosen." : "Your portrait follows your race and sex again."); break; }
      case "inn": say(b.dataset.c === "room" ? TOWNS.rentRoom(S) : TOWNS.rumour(S)); break;
      case "train": say(TOWNS.train(S, b.dataset.id)); publishCard(); break;
      case "alch": { const id = +b.dataset.id; alchSel = alchSel.includes(id) ? alchSel.filter((x) => x !== id) : [...alchSel, id].slice(-3); renderPanel(true); break; }
      case "brew": { const sel = [...alchSel], ids = sel.map((id) => G.invRow(S, id)?.item).filter(Boolean), canMix = S.location && TOWNS.isTown(S.location) && ids.length >= 2 && TOWNS.brewPreview(S, ids).length;
        const go = (g) => { alchSel = sel; const before = S.inv.filter((x) => String(x.item).startsWith("brew|")).reduce((a, x) => a + x.qty, 0); const r = CG.brew(S, alchSel, g); const made = S.inv.filter((x) => String(x.item).startsWith("brew|")).reduce((a, x) => a + x.qty, 0) - before; if (made > 0) tally("potions", made); alchSel = []; persist(); renderPanel(true); showMessage("Alchemy", r.text + ((r.skills || []).length ? "  " + r.skills.join(" · ") : "")); };
        if (canMix) CG.run("mix", { skill: G.skill(S, "Alchemy"), skillName: "Alchemy", what: ids.map((x) => D.ITEMS[x].name).join(" + ") }, go); else go(CG.QUICK); break; }
      case "temper": GUIDE.mark(S, "smith"); say(TOWNS.temper(S, +b.dataset.id)); publishCard(); break;
      case "soctab": socTab = b.dataset.id; socWith = null; renderPanel(true); break;
      case "fadd": case "faddrec": { const c = cardOf(b.dataset.id) || (() => { const d = friendDocs.find((x) => x.id === b.dataset.id); return d ? { id: d.id, name: d.name } : null; })(); if (!c) return toast("They're not around."); const m = SOCIAL.add(S, c); persist(true); publishFriends(); toast(m); renderPanel(true); renderTabs(); break; }
      case "fdelask": fRemoveAsk = b.dataset.id; renderPanel(true); break;
      case "fdel": toast(SOCIAL.remove(S, b.dataset.id)); fRemoveAsk = null; persist(true); publishFriends(); renderPanel(true); break;
      case "fjoin": if (typeof FRIENDJOIN !== "undefined") FRIENDJOIN.ask(b.dataset.id); break;
      case "fmsg": socTab = "msgs"; socWith = b.dataset.id; tab = "social"; renderTabs(); renderPanel(true); setTimeout(() => { const cl = $("#chatlog"); if (cl) cl.scrollTop = cl.scrollHeight; }, 20); break;
      case "dmback": socWith = null; renderPanel(true); break;
      case "dmsend": sendDM(); break;
      case "ftrade": { const c = friendCard(b.dataset.id); if (c) { tradeSel = []; openTrade(c); } break; }
      case "craftgo": { const r = SPELLCRAFT.craft(S, craftChoices(), craftDraft.name); if (r.err) return toast(r.err); craftDraft = { a: "", am: 0, b: "", bm: 0, name: "" }; SOUND.fx("coin"); persist(true); say(r.text); renderPanel(true); break; }
      case "runetable": RUNECRAFT.open(S, { save: () => persist(true), say: (m) => toast(m), refresh: () => renderPanel(true) }); break;
      case "craftdel": say(SPELLCRAFT.forget(S, b.dataset.id)); persist(true); renderPanel(true); break;
      case "mine": {
        const no = SMITH.mineBlock(S); if (no) { say(no); break; }
        const at = S.location, go = (got) => { if (got === "cancel" || S.location !== at) return; const m = SMITH.mine(S, at, G.now(), got); if (m.startsWith("")) { SOUND.fx("clang"); persist(true); } say(m); renderPanel(true); };
        if (typeof MINEGAME !== "undefined") MINEGAME.play(S, at, go); else go(null); break; }
      case "ftab": forgeTab = b.dataset.id; renderPanel(true); break;
      case "fgroup": forgeGroup = b.dataset.id; renderPanel(true); break;
      case "smake": { const id = b.dataset.id, inf = SMITH.atForge(S) && SMITH.info(S, id);
        const go = (g) => { const m = CG.smithMake(S, id, g); if (/^You make/.test(m)) { GUIDE.mark(S, "smith"); SOUND.fx("clang"); tally("crafted"); publishCard(); } if (/^(You make|Botched)/.test(m)) persist(true); say(m); };
        if (inf && !inf.block) CG.run(CG.gameFor("smith", id), { skill: G.skill(S, "Smithing"), skillName: "Smithing", what: D.ITEMS[id].name, id, s: S }, go); else go(CG.QUICK); break; }
      case "srefine": case "srefineall": { const k = +b.dataset.id, all = a === "srefineall", inf = SMITH.atForge(S) && SMITH.refineInfo(S, k);
        const go = (g) => { const m = CG.refine(S, k, all, g); if (/^(You (smelt|tan)|You work|The heat|Your knife)/.test(m)) persist(true); say(m); };
        if (inf && inf.times) CG.run(CG.gameFor("refine", k), { skill: G.skill(S, "Smithing"), skillName: "Smithing", what: `${inf.n * (all ? inf.times : 1)} ${D.ITEMS[inf.out].name}` }, go); else go(CG.QUICK); break; }
      case "takejob": say(TOWNS.takeJob(S, b.dataset.id)); break;
      case "dropjob": say(TOWNS.dropJob(S, b.dataset.id)); break;
      case "handin": say(TOWNS.handIn(S, b.dataset.id)); break;
      case "pickpocket": {
        const streets = (plan) => { const r = TOWNS.pickTownsfolk(S, undefined, plan); persist(true); renderPanel(true); showMessage("The streets", r.text + ((r.skills || []).length ? "  " + r.skills.join(" · ") : "")); };
        if (typeof PICKGAME !== "undefined" && PICKGAME.wants() && TOWNS.townPickPlan && S.location && TOWNS.isTown(S.location)) {
          const plan = TOWNS.townPickPlan(S);
          PICKGAME.open({ title: `Pick ${plan.target}'s pocket`, sub: `Pickpocket ${G.skill(S, "Pickpocket")} · about ${Math.round(plan.chance * 100)}% chance`, chance: plan.chance }, (res) => { if (!res.left) streets(res.auto ? plan : { ...plan, hit: res.hit }); });
          break;
        }
        streets(null); break;
      }
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
    }
  }

  boot().catch((err) => { console.error(err); app.innerHTML = `<div class="panel" style="margin-top:24px"><h2>Something went wrong</h2><p class="sub">${esc(err.message)}</p></div>`; });
}
