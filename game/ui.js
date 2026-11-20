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
  let tacticsDraft = { if: "always", pct: 50, do: "attack" }, testResult = null, townShop = null, packOpen = null, searchText = "";
  let raidDocs = [], raidSeen = null, enchDraft = {};
  let perkSkill = null, alchSel = [], party = null, invites = [], chests = [], news = [], seenAttacks = new Set(), lastCardJson = "", lastAmbushCheck = 0;
  const app = $("#app"), tabsEl = $("#tabs");
  const bump = () => { version++; };

  // ------------------------------------------------------------ helpers
  function toast(text) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = text; el.classList.remove("hide");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hide"), 3800);
  }
  function persist(pub = false) { Store.save(S); if (pub) publishCard(); bump(); }
  function publishCard(force = true) {
    const tr = S.trip;
    const card = { name: S.name, race: S.race, level: S.level, x: S.x, y: S.y,
      t0: tr ? tr.lastTick : G.now(), moving: !!(tr && tr.status === "travel"), dest: tr ? tr.dest : null,
      path: tr && tr.status === "travel" ? [[S.x, S.y], ...tr.path.slice(tr.idx + 1)].slice(0, 120) : null,
      speed: G.speed(S), party: party?.id || null, hiding: !!S.ambush, ...MP.stats(S) };
    const json = JSON.stringify({ ...card, t0: 0, cur: Math.round(card.cur / 10) });
    if (!force && json === lastCardJson) return;
    lastCardJson = json;
    Store.publish({ ...card, updated: Date.now() });
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
  function otherPos(o, t = G.now()) {
    if (!o.moving || !o.path || o.path.length < 2) return [o.x, o.y];
    return Terrain.moveAlong(o.path, 0, o.path[0], Math.max(0, t - o.t0), (o.speed || 30) / 60).pos;
  }
  const tripMinutesLeft = () => Math.max(0, G.minutesLeft(S) - (S.trip?.status === "travel" ? (G.now() - S.trip.lastTick) / 60 : 0));
  const known = (n) => S.discovered.includes(n) || ["city", "town"].includes(WORLD.places[n][2]);
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
    if (!S) showCreate(); else start();
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
        <h3 style="margin-top:14px">Choose your race</h3>
        <div class="races">${Object.entries(D.RACES).map(([id, r]) => `
          <button class="race ${id === race ? "on" : ""}" data-race="${id}" aria-pressed="${id === race}">
            <b>${esc(r.name)}</b><span>+10 ${esc(r.skills[0])} · ${esc(r.power)}</span></button>`).join("")}
        </div>
        <p class="sub" style="margin-top:10px">${esc(D.RACES[race].desc)} Also +5 ${esc(D.RACES[race].skills.slice(1).join(", "))}.</p>
        <button class="btn pri" id="begin" style="width:100%;margin-top:8px">Begin in ${esc(D.START_LOCATION)}</button>
        <p class="sub status ${net.mode === "shared" || net.mode === "p2p" ? "live" : ""}" style="margin-top:10px"><i></i>${net.mode === "shared" ? "Shared world: other players will see you on the map." : net.mode === "p2p" ? "One world for everyone with the app: your game is saved on this phone and syncs straight with everyone else's." : APP ? "Offline game: saved on this phone." : "Saved in this browser only (shared saving unavailable here)."}</p>${net.mode === "shared" || net.mode === "p2p" ? "" : onlineBtn().replace('data-act="online"', 'id="online"')}
      </div>`;
      app.querySelectorAll("[data-race]").forEach((b) => b.onclick = () => { race = b.dataset.race; const v = $("#nm").value; draw(); $("#nm").value = v; });
      if ($("#online")) $("#online").onclick = openOnline;
      $("#begin").onclick = () => {
        const name = ($("#nm").value || "").trim().slice(0, 24) || "Dovahkiin";
        S = G.newSave(Store.uid, name, race);
        persist(true);
        start();
      };
    };
    draw();
  }

  // ------------------------------------------------------------ main screen
  window.__dbg = { save: () => S, openEvent: (n) => openEvent(n) };   // for testing in the browser console
  /* phone back button: close what's on top, step back to the map, and only then leave the app */
  window.__ui = {
    back() {
      if ($("#sky") && !$("#modal")) { closeMenu(); return true; }
      if ($("#modal")) { if (!$("#modal [data-act=enc], #modal [data-act=ev], #modal [data-act=guard]")) closeModal(); return true; }
      if ($("#dun")) { closeDungeon(); return true; }
      if (selected) { selected = null; renderPicked(); return true; }
      if (S && tab !== "map") { tab = "map"; bump(); renderTabs(); renderPanel(true); return true; }
      return false;
    },
    save() { if (S) Store.save(S); },
  };
  function start() {
    app.innerHTML = `
      <div class="top"><div class="who"><b id="nm"></b><span id="sub"></span></div>
        <div class="meta"><div id="clock"></div><div class="gold" id="goldv"></div></div></div>
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
    tabsEl.onclick = (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; if (b.dataset.tab === "pack") return openMenu("items"); closeMenu(); tab = b.dataset.tab; testResult = null; bump(); renderTabs(); renderPanel(true); $("#side").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); };
    $("#zoomBtn").onclick = () => { zoom = zoom > 1.01 ? 1 : 2.4; follow = true; $("#zoomBtn").textContent = zoom > 1.01 ? "－" : "＋"; };
    $("#centerBtn").onclick = () => { follow = true; if (zoom === 1) zoom = 2.4; $("#zoomBtn").textContent = "－"; };
    bindMap();
    $("#side").addEventListener("click", onPanelClick);
    $("#side").addEventListener("change", onPanelChange);
    $("#side").addEventListener("input", onPanelInput);
    $("#trip").addEventListener("click", onPanelClick);
    $("#raid").addEventListener("click", onPanelClick);
    Store.watch("raids", (docs) => { raidDocs = docs; });
    $("#picked").addEventListener("click", onPanelClick);
    Store.watchPlayers((ps) => { others = ps; if (tab === "log") bump(); });
    Store.watchBags((b) => { bags = b; });
    Store.watch("attacks", (docs) => onAttacks(docs));
    Store.watch("parties", (docs) => {
      party = docs.find((p) => p.members?.some((m) => m.id === S.id)) || null;
      invites = docs.filter((p) => p.invites?.includes(S.id) && !p.members.some((m) => m.id === S.id));
      if (tab === "log") bump();
    });
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
    requestAnimationFrame(frame);
    if (S.trip?.status === "encounter") openEncounter();
    else if (S.trip?.status === "event") openEvent();
    if (S.dungeon) renderDungeon();
  }
  /* road events: only while you're watching. About one every 3 minutes of walking, never two within a minute. */
  let lastEventAt = Date.now();
  const EVENT_PER_SECOND = 1 / 180, EVENT_GAP_MS = 60000;
  function maybeRoadEvent() {
    if (document.hidden || $("#modal") || S.trip?.status !== "travel" || S.trip.carriage || Date.now() - lastEventAt < EVENT_GAP_MS) return;
    if (G.minutesLeft(S) < 0.5 || Math.random() > EVENT_PER_SECOND) return;
    lastEventAt = Date.now();
    [S.x, S.y] = livePos();
    if (G.startEvent(S)) { persist(); openEvent(); }
  }

  function tick() {
    if (!S) return;
    const t = G.now();
    if (S.trip?.status === "travel") {
      const out = G.advance(S, t, reachableBags());
      if (out.taken.length || out.bag || out.died || out.encounter || out.arrived) {
        out.taken.forEach((id) => Store.takeBag(id));
        if (out.bag) Store.addBag(out.bag);
        persist(true);
        if (out.died) showMessage("You died", out.died, true);
        else if (out.encounter) openEncounter();
        else if (out.arrived) {
          toast(`Arrived at ${out.arrived}.` + (G.shopTypes(out.arrived).length ? " Shops are in the Town tab." : DUNGEONS.enterable(out.arrived) ? " You can go inside." : ""));
          selected = null; renderPanel(true);
          const jm = TOWNS.checkJobs(S); if (jm.length) { persist(); setTimeout(() => toast(jm.join(" ")), 1500); }
          if (TOWNS.guardCheck(S)) openGuard();
        }
      } else { Store.save(S); maybeRoadEvent(); }
    }
    followParty(); checkAmbush(); renderRaid();
    if (Math.floor(t) % 30 === 0) publishCard(false);
    renderTop(); renderVitals(); renderTrip(); renderTabs();
    if (version !== rendered || Date.now() - lastPanelRender > 20000) renderPanel(false);
  }

  function renderTop() {
    $("#nm").textContent = S.name;
    const where = S.location || `the wilds of ${G.holdAt(livePos())}`;
    $("#sub").textContent = `Level ${S.level} ${D.RACES[S.race].name} · ${where}`;
    const wx = WEVENTS.weather(livePos()), dt = WEVENTS.date();
    $("#clock").textContent = `${G.isNight() ? "🌙" : "☀️"} ${dt.day} ${dt.month}, ${G.clockText().split(", ")[1]} · ${wx.icon} ${wx.name}`;
    $("#goldv").textContent = `${S.gold} gold`;
  }
  function renderVitals() {
    const hp = G.curHealth(S), mh = G.maxHealth(S);
    const row = (label, cur, max, color) => `<div class="vital"><small><span>${label}</span><span class="num">${Math.round(cur)}/${max}</span></small><div class="bar"><i style="width:${pct(cur, max)}%;background:${color}"></i></div></div>`;
    const w = G.carried(S), cap = G.capacity(S);
    $("#vitals").innerHTML = row("Health", hp, mh, "var(--hp)") + row("Magicka", G.maxMagicka(S), G.maxMagicka(S), "var(--mp)") + row(G.overweight(S) ? "Weight · too heavy" : "Weight", w, cap, w > cap ? "var(--ember)" : "#8a7a5c");
  }
  function renderTrip() {
    const el = $("#trip"), tr = S.trip;
    if (S.dungeon) { el.innerHTML = `<div class="trip enc"><div class="row"><b>🕯 You're inside ${esc(S.dungeon.place)}</b><button class="btn danger sm" data-act="dun">Go back in</button></div></div>`; return; }
    if (!tr) { el.innerHTML = ""; return; }
    if (tr.status === "event") {
      el.innerHTML = `<div class="trip"><div class="row"><b>🛤 Something by the road</b><button class="btn pri sm" data-act="openev">Look</button></div></div>`;
      return;
    }
    if (tr.status === "encounter") {
      el.innerHTML = `<div class="trip enc"><div class="row"><b>⚠️ ${esc(tr.encounter.name)} blocks the road</b><button class="btn danger sm" data-act="openenc">Face it</button></div></div>`;
      return;
    }
    const mins = tripMinutesLeft(), total = Math.max(mins, tr.total || mins), p = pct(total - mins, total);
    const here = livePos(), ground = Terrain.NAMES[Terrain.typeAtPos(here)], sp = Terrain.speedAt(here);
    const pace = sp >= 1.2 ? "fast going" : sp >= 0.95 ? "steady" : sp >= 0.6 ? "slow going" : "very slow going";
    el.innerHTML = `<div class="trip"><div class="row"><b>${esc(tr.origin)} → ${esc(tr.destName)}</b><span class="num sub">${fmtMin(mins)}</span><button class="btn sm" data-act="stop">Stop</button></div>
      <div class="bar"><i style="width:${p}%;background:var(--frost)"></i></div>
      <div class="sub">${tr.carriage ? "🐎 by carriage · safe on the Jarl's roads" : `${esc(ground)} · ${pace} · ${S.horse ? "on horseback" : G.overweight(S) ? "too heavy to run" : "on foot"}`}${S.follower ? ` · ${esc(TOWNS.FOLLOWERS[S.follower.id][0])} with you` : ""}</div>
      ${tr.log.length ? `<div class="sub">${esc(tr.log[0])}</div>` : `<div class="sub">The trip keeps going while the page is closed.</div>`}</div>`;
  }
  function renderTabs() {
    tabsEl.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on);
      const needDot = (b.dataset.tab === "hero" && (S.pendingLevels > 0 || PERKS.pointsLeft(S) > 0)) || (b.dataset.tab === "log" && (invites.length || chests.length));
      if (needDot && !b.querySelector(".dot")) b.insertAdjacentHTML("beforeend", '<span class="dot"></span>');
      if (!needDot) b.querySelector(".dot")?.remove();
    });
  }

  // ------------------------------------------------------------ map
  let lastFrame = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden || ts - lastFrame < 33 || !$("#map")) return;
    lastFrame = ts;
    const pos = livePos();
    if (follow) center = pos;
    view = {
      player: pos, name: S.name, trail: S.trip?.trail, dest: S.trip ? { pos: S.trip.dest, name: S.trip.destName } : null,
      route: S.trip ? (S.trip.status === "travel" ? S.trip.path.slice(S.trip.idx + 1) : [S.trip.dest]) : null,
      discovered: S.discovered, explored: [...S.explored, pos], others: others.filter((o) => !o.hiding || G.pxDist(livePos(), otherPos(o)) < MP.NEAR_PX).map((o) => ({ name: o.name + (party?.members.some((m) => m.id === o.id) ? " ⚑" : ""), pos: otherPos(o) })),
      bags: visibleBags(), selected, t: ts / 1000, zoom, center, reduceMotion, weather: WEVENTS.weather(pos).id,
    };
    WorldMap.draw($("#map"), view);
  }
  function bindMap() {
    const c = $("#map"), pts = new Map();
    let down = null, moved = false, pinch = null;
    const setZoom = (z, fx, fy) => {     // zoom keeping the point under the fingers still
      z = Math.max(1, Math.min(4, z));
      if (view.transform && fx != null) {
        const { k, ox, oy } = view.transform, mx = (fx - ox) / k / WorldMap.W, my = (fy - oy) / k / WorldMap.H;
        const r = c.getBoundingClientRect(), nk = k * z / zoom;
        center = [mx - (fx - r.width / 2) / nk / WorldMap.W, my - (fy - r.height / 2) / nk / WorldMap.H];
        follow = false;
      }
      zoom = z; $("#zoomBtn").textContent = zoom > 1.01 ? "－" : "＋";
    };
    c.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]); c.setPointerCapture(e.pointerId);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom }; moved = true; }
      else { down = { x: e.clientX, y: e.clientY, c: [...center] }; moved = false; }
    });
    c.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const r = c.getBoundingClientRect();
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        setZoom(pinch.z * d / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        return;
      }
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 8) moved = true;
      if (moved && zoom > 1 && view.transform) { follow = false; center = [down.c[0] - dx / (WorldMap.W * view.transform.k), down.c[1] - dy / (WorldMap.H * view.transform.k)]; }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [p] = [...pts.values()]; down = { x: p[0], y: p[1], c: [...center] }; return; }
      if (!down) return;
      const wasMove = moved; down = null;
      if (wasMove || !view.transform || e.type === "pointercancel") return;
      const r = c.getBoundingClientRect();
      selected = WorldMap.placeAt(view, e.clientX - r.left, e.clientY - r.top, known);
      renderPicked();
    };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", (e) => { e.preventDefault(); const r = c.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }
  function renderPicked() {
    const el = $("#picked");
    if (!selected) { el.classList.add("hide"); return; }
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
    toast(`You set off for ${name}. About ${fmtMin(S.trip.total)}.`);
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
    openModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn ${bad ? "danger" : "pri"}" data-act="close" style="width:100%">Continue</button>`, bad ? "enc" : "");
  }
  function fightLog(f) {
    return `<details ${f.log.length < 9 ? "open" : ""}><summary class="sub" style="cursor:pointer;min-height:36px">Fight log (${f.turn} turns) — [n] is the tactic rule that fired</summary><div class="flog">${f.log.map((l) =>
      `<div><span class="r">${l.turn ? `T${l.turn}` : "⚡"}${l.rule != null ? `<br>[${l.rule || "–"}]` : ""}</span><span>${esc(l.me)}${l.me && l.them ? " · " : ""}${esc(l.them)}${l.hp != null ? ` <span class="sub">(you ${l.hp} · foe ${l.ehp})</span>` : ""}</span></div>`).join("")}</div></details>`;
  }
  function openEncounter(note) {
    const e = S.trip?.encounter;
    if (!e) return;
    openModal(`<p class="sub danger-${e.danger}" style="margin:0">${e.danger === "high" ? "Deadly" : e.danger === "medium" ? "Dangerous" : "Minor"} encounter · ${esc(e.hold)}${G.isNight() ? " · night" : ""}</p>
      <h2 style="margin:4px 0 8px">${esc(e.name)}</h2><p>${esc(e.text)}</p>
      ${note ? `<p class="sub">${esc(note)}</p>` : ""}
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
    const shop = ev.shop ? `<div class="list" style="margin:8px 0">${ev.shop.map((i) => { const p = G.buyPrice(S, i); return `<div class="item"><div class="t">${esc(D.ITEMS[i].name)}<span>${esc(G.itemStats(i))} · ${D.ITEMS[i].weight} wt</span></div><span class="num gold">${p}</span><button class="btn sm" data-act="evbuy" data-item="${i}" ${S.gold >= p ? "" : "disabled"}>Buy</button></div>`; }).join("")}</div><p class="sub">You have ${S.gold} gold.</p>` : "";
    const choices = ev.shop ? [["leave", "Say goodbye and move on"]] : G.eventChoices(S);
    openModal(`<p class="sub" style="margin:0">On the road · ${esc(G.holdAt([S.x, S.y]))} · ${esc(Terrain.NAMES[Terrain.typeAtPos([S.x, S.y])])}</p>
      <h2 style="margin:4px 0 8px">Something by the road</h2><p>${esc(ev.text)}</p>
      ${note ? `<p class="sub">${esc(note)}</p>` : ""}${shop}
      <div class="evc">${choices.map(([c, label]) => `<button class="btn ${c === "leave" ? "" : "pri"}" data-act="ev" data-c="${c}">${esc(label)}</button>`).join("")}</div>`);
  }
  function eventAction(c) {
    const r = G.eventChoice(S, c);
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (r.fight || r.died) return showFightResult(r);
    if (S.trip?.status === "event") return openEvent([r.text, ...(r.skills || [])].filter(Boolean).join(" "));
    if (c === "leave") return closeModal();
    openModal(`<h2>On the road</h2><p>${esc(r.text)}</p>${skillLine(r)}
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
  function placeHere() {
    const l = S.location;
    if (l && !S.trip && POWERS.STONE_AT[l]) {
      return `<div class="panel" style="border-color:var(--gold)"><h2>${esc(l)}</h2><p class="sub">A standing stone. You can carry the blessing of one stone at a time; touching another replaces it.${S.stone ? ` Yours now: ${esc(POWERS.STONES[S.stone][0])}.` : ""}</p>
        <div class="list">${POWERS.STONE_AT[l].map((id) => `<div class="item ${S.stone === id ? "on" : ""}"><div class="t">${esc(POWERS.STONES[id][0])}<span>${esc(POWERS.STONES[id][1])}</span></div><button class="btn sm pri" data-act="stone" data-id="${id}" ${S.stone === id ? "disabled" : ""}>${S.stone === id ? "Yours" : "Choose"}</button></div>`).join("")}</div></div>`;
    }
    if (l === "High Hrothgar" && !S.trip) return `<div class="panel" style="border-color:var(--gold)"><h2>High Hrothgar</h2><p class="sub">Seven thousand steps up the Throat of the World, the Greybeards wait in silence.</p>
      <button class="btn pri" data-act="greybeards" style="width:100%" ${S.greybeards ? "disabled" : ""}>${S.greybeards ? "They have taught you all they will, for now" : "Speak with the Greybeards"}</button></div>`;
    if (!l || !DUNGEONS.enterable(l) || S.trip) return "";
    const left = DUNGEONS.refillLeft(S, l), lvl = { 1: 1, 2: 6, 3: 12 }[DUNGEONS.info(l).tier];
    const th = DUNGEONS.info(l).theme, rec = th === "lair" ? 20 : th === "giantcamp" ? 10 : lvl;
    return `<div class="panel" style="border-color:var(--ember)"><h2>${esc(l)}</h2><p class="sub">${esc(DUNGEONS.describe(l))} · good from about level ${rec}. Inside, you pick your own way room by room down to the boss. Health doesn't come back on its own in there, and you can leave between rooms whenever you like.</p>
      ${left ? `<p class="sub">You cleared it. Something new moves in within about ${Math.ceil(left / 3600)} hours.</p>` : `<button class="btn danger" data-act="enter" style="width:100%">🕯 Go inside</button>`}</div>`;
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
    const res = dunNote ? `<div class="card res"><p>${esc(dunNote.text)}</p>${dunNote.fight ? fightLog(dunNote.fight) : ""}
      ${dunNote.loot?.length || dunNote.gold ? `<p>Loot: <b>${[dunNote.gold ? dunNote.gold + " gold" : "", ...(dunNote.loot || [])].filter(Boolean).map(esc).join(", ")}</b></p>` : ""}${skillLine(dunNote)}</div>` : "";
    let main;
    if (d.done) main = `<div class="card"><h3>🏆 ${esc(d.place)} is cleared</h3><p class="sub">Found so far: ${d.gold} gold${d.found.length ? ", " + d.found.map(esc).join(", ") : ""}.</p><button class="btn pri" data-act="dleave" style="width:100%">Head back outside</button></div>`;
    else if (r) {
      const e = r.enemy;
      main = `<div class="card ${e ? "foe" : ""}"><h3>${DUNGEONS.ICON[r.type]} ${e ? esc(e.name) : DUNGEONS.LABEL[r.type]}</h3><p>${esc(r.text)}</p>
        ${e ? `<div class="vital"><small><span>${esc(e.name)}</span><span class="num">${e.hp}/${e.health} · hits for ~${Math.round(e.damage)}</span></small><div class="bar"><i style="width:100%;background:var(--ember)"></i></div></div>` : ""}
        <div class="evc">${DUNGEONS.roomChoices(S).map(([c, label]) => `<button class="btn ${["fight", "pick", "rest", "read", "pray", "open", "loot", "burn", "dash"].includes(c) || c.startsWith("set:") ? (e ? "danger" : "pri") : ""}" data-act="dact" data-c="${esc(c)}">${esc(label)}</button>`).join("")}</div>
        ${e ? `<p class="sub" style="margin-bottom:0">Fighting uses your <b>${esc(S.loadout)}</b> tactics.</p>` : ""}</div>`;
    } else {
      const nx = DUNGEONS.nextChoices(S), row = d.rows[d.row + 1];
      main = `<div class="card"><h3>${d.row < 0 ? "The entrance" : "Which way?"}</h3><p class="sub">${d.row < 0 ? `You light a torch and step into ${esc(d.place)}.` : "The passage splits."} Tap a glowing room on the map, or pick here:</p>
        <div class="evc">${nx.map((c) => `<button class="btn ${row[c].type === "boss" ? "danger" : ""}" data-act="droom" data-c="${c}">${DUNGEONS.ICON[row[c].type]} ${DUNGEONS.LABEL[row[c].type]}</button>`).join("")}</div></div>`;
    }
    el.innerHTML = `<div class="in">
      <div class="hd"><h2>🕯 ${esc(d.place)}</h2><button class="btn sm" data-act="dmin">🎒 Pack</button>${d.done || r?.type === "boss" ? "" : `<button class="btn sm" data-act="dleave">Leave</button>`}</div>
      <div class="vital"><small><span>Health${r ? "" : " · no natural healing in here"}</span><span class="num">${Math.round(hp)}/${mh}</span></small><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--hp)"></i></div></div>
      <p class="sub" style="margin:0">Room ${step} of ${total} · found ${d.gold} gold${d.found.length ? ` and ${d.found.length} item${d.found.length > 1 ? "s" : ""}` : ""} · ${G.countRestore(S, "health")} healing potions</p>
      ${res}${main}
      <div class="card"><div class="legend">${["fight", "elite", "trap", "treasure", "puzzle", "rest", "mystery", "boss"].filter((k) => d.rows.some((row) => row.some((n) => n.type === k))).map((k) => `<span>${DUNGEONS.ICON[k]} ${DUNGEONS.LABEL[k]}</span>`).join("")}</div>${dunMap(d)}</div>
    </div>`;
    el.scrollTop = 0;
  }
  function dungeonRoom(c) {
    const d = S.dungeon, err = DUNGEONS.enterRoom(S, +c);
    if (err) return toast(err);
    d.path = d.path || []; d.path.push([d.row, d.col]);
    dunNote = null; persist(); renderDungeon();
  }
  function dungeonAct(c) {
    const r = DUNGEONS.act(S, c);
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (r.died) { dunNote = null; closeDungeon(); renderPanel(true); openModal(`<h2>💀 Defeated</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}<p>${esc(r.died)}</p><button class="btn danger" data-act="close" style="width:100%">Continue</button>`, "enc"); return; }
    if (r.partyChest && party) {
      const id = `${S.id}-${Math.floor(G.now())}`;
      Store.put("chests", id, { gold0: r.partyChest.gold, items0: r.partyChest.items, goldLeft: r.partyChest.gold, itemsLeft: r.partyChest.items, taken: [],
        members: party.members, place: S.dungeon?.place || "", byName: S.name, t: G.now() });
      postNews(`💰 ${S.name}'s party cleared ${S.dungeon?.place}. The chest is waiting to be shared.`);
    } else if (r.partyChest) { S.gold += r.partyChest.gold; r.partyChest.items.forEach((i) => G.give(S, i)); }
    if (r.cleared) { const jm = TOWNS.checkJobs(S); if (jm.length) r.text += " " + jm.join(" "); postNews(`🏆 ${S.name} cleared ${S.dungeon?.place}.`); }
    persist(true);
    dunNote = r; renderDungeon();
  }


  // ------------------------------------------------------------ Skyrim-style menu (Items / Magic / Skills), SkyUI-like lists
  let sky = { page: "items", cat: "all", sort: "name", dir: 1, sel: null };
  const ICONS = {
    all: '<path d="M4 6h16M4 12h16M4 18h16"/>', weapons: '<path d="M5 19L17 7l2-4-4 2L3 17zM7 14l3 3"/>', apparel: '<path d="M8 3l4 2 4-2 4 4-3 3v11H7V10L4 7z"/>',
    potions: '<path d="M10 3h4M10 3v5l-4 8a4 4 0 004 6h4a4 4 0 004-6l-4-8V3"/>', scrolls: '<path d="M7 4h10a2 2 0 010 4H9v12H7a2 2 0 01-2-2V6a2 2 0 012-2zM9 8h8v10a2 2 0 01-2 2H9"/>',
    books: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5"/>', ingredients: '<path d="M12 21V11M12 11c-4 0-6-3-6-7 4 0 6 3 6 7zm0 0c4 0 6-3 6-7-4 0-6 3-6 7z"/>',
    misc: '<path d="M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10"/>',
    destruction: '<path d="M12 3c3 4 6 6 6 10a6 6 0 01-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-2-1-4 0-6z"/>', restoration: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="5"/>',
    alteration: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/>', conjuration: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>', illusion: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    powers: '<path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>', shouts: '<path d="M4 9v6h4l6 5V4L8 9zM17 8a5 5 0 010 8M19 5a9 9 0 010 14"/>', effects: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
    combat: '<path d="M5 19L19 5M14 5h5v5"/>', magic: '<circle cx="12" cy="12" r="8"/><path d="M12 4l2 8-2 8-2-8z"/>', stealth: '<path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/>', other: '<circle cx="12" cy="12" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.misc}</svg>`;
  const ITEM_CATS = [["all", "All"], ["weapons", "Weapons"], ["apparel", "Apparel"], ["potions", "Potions"], ["scrolls", "Scrolls"], ["books", "Books"], ["ingredients", "Ingredients"], ["misc", "Misc"]];
  const catOf = (it) => it.slot === "weapon" ? "weapons" : G.ARMOR_SLOTS.includes(it.slot) ? "apparel" : ["potion", "poison"].includes(it.slot) ? "potions"
    : it.slot === "scroll" ? "scrolls" : it.slot === "tome" ? "books" : it.slot === "ingredient" ? "ingredients" : "misc";
  const MAGIC_CATS = [["all", "All"], ["destruction", "Destruction"], ["restoration", "Restoration"], ["alteration", "Alteration"], ["conjuration", "Conjuration"], ["illusion", "Illusion"], ["powers", "Powers"], ["shouts", "Shouts"], ["effects", "Active effects"]];
  const SKILL_CATS = [["all", "All"], ["combat", "Warrior"], ["magic", "Mage"], ["stealth", "Thief"], ["other", "Other"]];
  const SKILL_GROUP = { combat: "Warrior", magic: "Mage", stealth: "Thief" };
  function openMenu(page = "items") { sky = { ...sky, page, cat: "all", sel: null }; renderMenu(); }
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
    let rows = S.inv.filter((r) => D.ITEMS[r.item] && (sky.cat === "all" || catOf(D.ITEMS[r.item]) === sky.cat)).map((r) => {
      const it = D.ITEMS[r.item];
      return { id: r.id, r, it, name: (r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + it.name, stat: itemStat(r), weight: +(it.weight * r.qty).toFixed(2), value: it.value, eq: eqIds.has(r.id) };
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
    if (it.aenchant) lines.push(`${it.aenchant.name} ${it.aenchant.mag} while worn`);
    if (it.effects) lines.push(it.effects.map(([e, m, dd]) => `${e} ${m}${dd * 5 >= 60 ? ` for ${Math.round(dd * 5 / 60)} min` : ""}`).join(" · "));
    else if (it.restore) lines.push(`Restores ${it.restore[1]} ${it.restore[0]}`);
    if (it.slot === "scroll" || it.slot === "tome") lines.push(`${it.slot === "tome" ? "Teaches" : "Casts"} ${D.SPELLS[it.spell].name}${it.slot === "tome" && S.spells.includes(it.spell) ? " (you know it)" : ""}`);
    if (it.slot === "ingredient" && TOWNS.INGREDIENT_FX[r.item]) lines.push("Effects: " + TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? e : "?").join(", "));
    if (it.slot === "material") lines.push("Used at the forge to improve gear.");
    if (r.stolen) lines.push("Stolen. Only a fence will buy it.");
    const acts = [];
    if (G.SLOTS.includes(it.slot)) acts.push(eq ? `<button class="btn" data-act="uneq" data-slot="${it.slot}">Unequip</button>` : `<button class="btn pri" data-act="eq" data-id="${r.id}">Equip</button>`);
    if (it.slot === "tome") acts.push(`<button class="btn pri" data-act="read" data-id="${r.id}">Read</button>`);
    if (it.slot === "potion") acts.push(`<button class="btn pri" data-act="drinkrow" data-id="${r.id}">Drink</button>`);
    if (it.slot === "poison") acts.push(`<button class="btn pri" data-act="poison" data-id="${r.id}">Coat weapon</button>`);
    if (it.slot === "ingredient") acts.push(`<button class="btn" data-act="eat" data-id="${r.id}">Eat</button>`);
    if (it.enchant) acts.push(...gems.map((g) => `<button class="btn" data-act="recharge" data-id="${r.id}" data-gem="${g.id}">Recharge (${esc(D.ITEMS[g.item].name.split(" (")[0])})</button>`));
    if (canShop) acts.push(`<button class="btn" data-act="sell" data-id="${r.id}">Sell · ${G.sellPrice(S, r)} gold</button>`);
    return `<div class="sky-detail"><h3>${esc(row.name)}</h3><div class="sky-stats">${stats.map(([k, v]) => `<div><span>${k}</span><b class="num">${esc(String(v))}</b></div>`).join("")}</div>
      ${lines.map((l) => `<p class="sub">${esc(l)}</p>`).join("")}<div class="sky-acts">${acts.join("")}</div></div>`;
  }
  // ---- magic
  const inTactics = (a) => G.loadout(S).rules.some((r) => r.do === a);
  function magicRows() {
    const out = [];
    for (const id of S.spells) { const sp = D.SPELLS[id]; out.push({ id: `spell:${id}`, cat: sp.school.toLowerCase(), name: sp.name, cost: G.spellCost(S, sp), sub: sp.school }); }
    out.push({ id: "power:race", cat: "powers", name: POWERS.RACE[S.race][0], cost: null, sub: POWERS.powerReady(S, "race") ? "Ready" : "Used today" });
    if (POWERS.stoneHasPower(S)) out.push({ id: "power:stone", cat: "powers", name: POWERS.STONES[S.stone][0], cost: null, sub: POWERS.powerReady(S, "stone") ? "Ready" : "Used today" });
    for (const [id, [name, words]] of Object.entries(POWERS.SHOUTS)) if (words.some((w) => POWERS.known(S, w))) out.push({ id: `shout:${id}`, cat: "shouts", name, cost: null, sub: words.map((w) => POWERS.known(S, w) ? (POWERS.unlocked(S, w) ? w : w + "🔒") : "···").join(" ") });
    const t = G.now();
    for (const f of (S.fx || []).filter((f) => f.until > t)) out.push({ id: `fx:${f.name}:${f.until}`, cat: "effects", name: f.name, cost: null, sub: `${f.mag} · ${Math.ceil((f.until - t) / 60)} min` });
    if (G.rested(S)) out.push({ id: "fx:rested", cat: "effects", name: (S.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested", cost: null, sub: `${Math.ceil((S.rested - t) / 60)} min` });
    if (S.stone) out.push({ id: "fx:stone", cat: "effects", name: POWERS.STONES[S.stone][0], cost: null, sub: "Standing stone" });
    return out.filter((r) => sky.cat === "all" ? !r.id.startsWith("fx:") : r.cat === sky.cat);
  }
  function magicDetail(row) {
    const [kind, arg] = row.id.split(":");
    let desc = "", acts = [];
    if (kind === "spell") {
      const sp = D.SPELLS[arg];
      desc = { damage: `${sp.amount} ${sp.element === "sun" ? "sun damage to undead" : `${sp.element} damage`}`, heal: `Heals ${sp.amount} health`, armor: `+${sp.amount} armor for the fight`, summon: `A familiar fights for you (${sp.amount} damage a turn)`, calm: `Stops a foe up to level ${sp.max_level} from fighting` }[sp.kind] || "";
      desc += ` · ${row.cost} magicka · ${sp.school}`;
    } else if (kind === "power") desc = arg === "race" ? POWERS.RACE[S.race][1] + " Once a day." : POWERS.STONES[S.stone][1];
    else if (kind === "shout") {
      const sh = POWERS.SHOUTS[arg], lv = POWERS.level(S, arg);
      desc = `${sh[3]} ${lv ? `You can shout ${lv} word${lv > 1 ? "s" : ""}; cooldown ${sh[2][lv - 1]} s.` : "Unlock its first word with a dragon soul."}`;
      acts.push(...sh[1].filter((w) => POWERS.known(S, w) && !POWERS.unlocked(S, w)).map((w) => `<button class="btn" data-act="unlock" data-id="${w}" ${(S.souls || 0) > 0 ? "" : "disabled"}>Unlock ${w} (dragon soul: ${S.souls || 0})</button>`));
      if (POWERS.ROAD_SHOUTS.includes(arg) && lv) acts.push(`<button class="btn pri" data-act="roadshout" data-id="${arg}" ${POWERS.voiceReady(S) ? "" : "disabled"}>Shout now</button>`);
    } else return `<div class="sky-detail"><h3>${esc(row.name)}</h3><p class="sub">${esc(row.sub)}</p></div>`;
    const usable = kind === "spell" || kind === "power" || (kind === "shout" && !POWERS.ROAD_SHOUTS.includes(arg) && POWERS.level(S, arg));
    if (usable) acts.unshift(inTactics(row.id) ? `<button class="btn" data-act="skytacx" data-id="${esc(row.id)}">Remove from tactics</button>` : `<button class="btn pri" data-act="skytac" data-id="${esc(row.id)}">Use first in every fight</button>`);
    return `<div class="sky-detail"><h3>${esc(row.name)}</h3><p class="sub">${esc(desc)}</p>${usable && inTactics(row.id) ? '<p class="sub">In your tactics. Fine-tune when it fires in the Tactics tab.</p>' : ""}<div class="sky-acts">${acts.join("")}</div></div>`;
  }
  // ---- skills
  function skillRows() {
    const group = (sk) => Object.entries(D.SKILL_GROUPS).find(([, l]) => l.includes(sk))?.[0];
    return D.ALL_SKILLS.map((sk) => ({ id: sk, name: sk, lvl: S.skills[sk].lvl, prog: pct(S.skills[sk].xp, F.skillXpNeeded(sk, S.skills[sk].lvl)), g: group(sk), perks: (PERKS.TREES[sk] || []).filter(([id]) => PERKS.rank(S, id)).length }))
      .filter((r) => sky.cat === "all" || (SKILL_GROUP[sky.cat] ? r.g === SKILL_GROUP[sky.cat] : !Object.values(SKILL_GROUP).includes(r.g)))
      .sort((a, b) => sky.sort === "name" ? a.name.localeCompare(b.name) * sky.dir : (b.lvl - a.lvl) * sky.dir);
  }
  function renderMenu() {
    let el = $("#sky");
    if (!el) {
      el = document.createElement("div"); el.id = "sky"; el.className = "sky"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Menu");
      el.addEventListener("click", onPanelClick); document.body.appendChild(el);
    }
    const cats = sky.page === "items" ? ITEM_CATS : sky.page === "magic" ? MAGIC_CATS : SKILL_CATS;
    let head = "", list = "", detail = "";
    if (sky.page === "items") {
      const rows = itemRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      const arrow = (k) => sky.sort === k ? (sky.dir > 0 ? " ▾" : " ▴") : "";
      head = `<div class="sky-head sky-cols"><button data-act="skysort" data-id="name">Name${arrow("name")}</button><button data-act="skysort" data-id="stat">${{ weapons: "Dmg", apparel: "Armor", potions: "Power" }[sky.cat] || "Stat"}${arrow("stat")}</button><button data-act="skysort" data-id="weight">Wt${arrow("weight")}</button><button data-act="skysort" data-id="value">Value${arrow("value")}</button></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols ${r.id === sky.sel ? "sel" : ""} ${r.eq ? "eq" : ""}" data-act="skysel" data-id="${r.id}"><span class="nm">${esc(r.name)}${r.r.qty > 1 ? ` <i>(${r.r.qty})</i>` : ""}${r.it.enchant || r.it.aenchant ? ' <i class="ench">✦</i>' : ""}${r.r.stolen ? ' <i class="stolen">✋</i>' : ""}</span><span class="num">${r.stat ?? "–"}</span><span class="num">${r.weight}</span><span class="num">${r.value}</span></button>`).join("") || '<p class="sub sky-empty">Nothing here.</p>';
      detail = sel ? itemDetail(sel) : "";
    } else if (sky.page === "magic") {
      const rows = magicRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      head = `<div class="sky-head sky-cols2"><span>Name</span><span>Cost</span></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols2 ${r.id === sky.sel ? "sel" : ""} ${inTactics(r.id) ? "eq" : ""}" data-act="skysel" data-id="${esc(r.id)}"><span class="nm">${esc(r.name)}<small>${esc(r.sub)}</small></span><span class="num">${r.cost ?? ""}</span></button>`).join("") || '<p class="sub sky-empty">Nothing here.</p>';
      detail = sel ? magicDetail(sel) : "";
    } else {
      const rows = skillRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      head = `<div class="sky-head sky-cols2"><button data-act="skysort" data-id="name">Skill</button><button data-act="skysort" data-id="lvl">Level</button></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols2 ${r.id === sky.sel ? "sel" : ""}" data-act="skysel" data-id="${esc(r.id)}"><span class="nm">${esc(r.name)}<span class="bar"><i style="width:${r.prog}%;background:var(--frost)"></i></span></span><span class="num">${r.lvl}</span></button>`).join("");
      detail = sel ? `<div class="sky-detail"><h3>${esc(sel.name)} ${sel.lvl}</h3><p class="sub">${sel.prog}% of the way to ${sel.lvl + 1}. ${sel.perks ? `${sel.perks} perk${sel.perks > 1 ? "s" : ""} taken.` : ""} Perk points to spend: ${PERKS.pointsLeft(S)}.</p>
        <div class="sky-acts">${PERKS.TREES[sel.id] ? `<button class="btn pri" data-act="skyperks" data-id="${esc(sel.id)}">Perk tree</button>` : ""}</div></div>` : "";
      if (S.pendingLevels > 0) detail = `<div class="sky-detail"><h3>Level up</h3><p class="sub">Choose what grows (+10), like Skyrim.</p><div class="sky-acts"><button class="btn" data-act="lvl" data-a="health">Health</button><button class="btn" data-act="lvl" data-a="magicka">Magicka</button><button class="btn" data-act="lvl" data-a="stamina">Stamina</button></div></div>` + detail;
    }
    const f = new G.Fight(S, { name: "-", health: 1, damage: 0, tags: [] });
    const armor = Math.round(f.armorRating().rating);
    let dmg = 0; for (let i = 0; i < 8; i++) dmg += f.weaponDamage(); dmg = Math.round(dmg / 8);
    const hp = G.curHealth(S), mh = G.maxHealth(S);
    el.innerHTML = `<div class="sky-in">
      <div class="sky-top"><button class="iconbtn" data-act="skyclose" aria-label="Close menu">✕</button>
        <div class="sky-pages">${[["items", "Items"], ["magic", "Magic"], ["skills", "Skills"]].map(([p, l]) => `<button class="sky-page ${p === sky.page ? "on" : ""}" data-act="skytab" data-id="${p}">${l}</button>`).join("")}</div></div>
      <div class="sky-cats">${cats.map(([k, l]) => `<button class="sky-cat ${k === sky.cat ? "on" : ""}" data-act="skycat" data-id="${k}" aria-label="${l}">${svgI(k)}<span>${l}</span></button>`).join("")}</div>
      <div class="sky-title">${esc((cats.find(([k]) => k === sky.cat) || cats[0])[1])}</div>
      ${head}<div class="sky-list">${list}</div>${detail}
      <div class="sky-foot"><span>Armor <b class="num">${armor}</b></span><span>Damage <b class="num">${dmg}</b></span><span>Weight <b class="num">${G.carried(S).toFixed(0)}/${G.capacity(S)}</b></span><span class="gold">${S.gold} gold</span></div>
      <div class="sky-vitals"><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--hp)"></i></div><div class="bar"><i style="width:100%;background:var(--mp)"></i></div><div class="bar"><i style="width:100%;background:var(--sp)"></i></div></div>
    </div>`;
  }

  // ------------------------------------------------------------ dragon attacks (world events)
  function renderRaid() {
    const el = $("#raid"); if (!el) return;
    const r = WEVENTS.activeRaid();
    if (!r) {
      if (S.raid && !S.raid.claimed) { /* the dragon might have died after the window: nothing to show */ }
      el.innerHTML = ""; return;
    }
    if (raidSeen !== r.id) {
      raidSeen = r.id; toast(`🐉 A dragon is attacking ${r.town}!`);
      if (!news.some((n) => n.text.includes(r.id))) postNews(`🐉 A dragon is attacking ${r.town}! Every warrior is needed. (${r.id})`);
    }
    const tl = WEVENTS.tally(r, raidDocs, S), left = Math.max(0, Math.ceil((r.end - G.now()) / 60)), done = tl.total >= tl.need;
    const msg = WEVENTS.claim(S, r, raidDocs);
    if (msg) { persist(true); showMessage("The dragon falls", msg); }
    const here = S.location === r.town;
    el.innerHTML = `<div class="trip enc" style="margin-top:10px"><div class="row"><b>🐉 ${done ? `The dragon over ${esc(r.town)} is dead` : `A dragon is attacking ${esc(r.town)}`}</b><span class="num sub">${done ? "" : `${left} min`}</span></div>
      <div class="bar"><i style="width:${pct(tl.total, tl.need)}%;background:var(--ember)"></i></div>
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
    persist(true); renderPanel(true); renderRaid();
    showFightResult({ ...out, text: out.text, loot: [], gold: 0 });
  }

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
  function renderPanel(force) {
    const side = $("#side");
    if (!force && side.contains(document.activeElement) && document.activeElement.matches("input,select")) return;
    rendered = version; lastPanelRender = Date.now();
    const openD = [...side.querySelectorAll("details")].map((d) => d.open), y = scrollY;
    side.innerHTML = ({ map: panelTravel, hero: panelHero, pack: panelPack, tactics: panelTactics, town: panelTown, log: panelLog }[tab])();
    if (!force) { side.querySelectorAll("details").forEach((d, i) => { if (openD[i] != null) d.open = openD[i]; }); scrollTo(0, y); }
  }

  function panelTravel() {
    const here = livePos();
    const places = Object.keys(WORLD.places).filter((n) => known(n) && n !== S.location && n.toLowerCase().includes(searchText.toLowerCase()))
      .map((n) => ({ n, d: G.pxDist(here, WORLD.places[n]) })).sort((a, b) => a.d - b.d);
    const bag = myBag();
    return `${placeHere()}<div class="panel"><h2>Where to?</h2><p class="sub">Tap a place on the map or pick one below. You'll follow roads where they help: they're fast, while marsh, snow and mountains are slow. New places appear as you pass near them.</p>
      <input id="search" placeholder="Search places" value="${esc(searchText)}" autocomplete="off" aria-label="Search places">
      <div class="list">${bag ? `<div class="item on"><div class="t">🎒 Your lost bag<span>${bag.gold} gold · ${Math.max(0, Math.floor((bag.expires - G.now()) / 60))} min left before it's fair game</span></div><button class="btn pri sm" data-act="go" data-place="__bag">Go</button></div>` : ""}
      ${places.slice(0, 40).map(({ n, d }) => { const k = WORLD.places[n][2]; return `<div class="item"><div class="t">${esc(n)}<span>${KIND[k]} · ${esc(G.holdAt(WORLD.places[n]))}${S.discovered.includes(n) ? "" : " · unvisited"}</span></div><span class="num sub">${d * 1.1 / G.speed(S) < 1 ? "" : "~"}${fmtMin(d * 1.1 / G.speed(S))}</span><button class="btn sm" data-act="go" data-place="${esc(n)}">Go</button></div>`; }).join("") || `<p class="sub">No places match.</p>`}</div>
      <p class="sub status ${Store.online ? "live" : ""}" style="margin-top:12px"><i></i>${Store.mode === "p2p" ? `The world · ${Store.peers ? `${Store.peers} other ${Store.peers === 1 ? "phone" : "phones"} online` : "looking for friends…"}` : Store.online ? `Shared world · ${others.length} other ${others.length === 1 ? "traveller" : "travellers"}` : APP ? "Offline game · saved on this phone" : "Saved in this browser only"}</p>${Store.online ? "" : onlineBtn()}</div>`;
  }

  function panelHero() {
    const need = 0 + (S.level + 3) * 25;
    const lvl = S.pendingLevels > 0 ? `<div class="panel" style="border-color:var(--gold)"><h2>Level up!</h2><p class="sub">You have ${S.pendingLevels} level-up${S.pendingLevels > 1 ? "s" : ""} to spend. Skyrim rules: +10 to one attribute.</p>
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))"><button class="btn" data-act="lvl" data-a="health">❤️ Health</button><button class="btn" data-act="lvl" data-a="magicka">🔷 Magicka</button><button class="btn" data-act="lvl" data-a="stamina">🟩 Stamina</button></div></div>` : "";
    const groups = Object.entries(D.SKILL_GROUPS).map(([g, list]) => `<h3 style="margin-top:14px">${esc(g)}</h3><div class="skills">${list.map((sk) => {
      const s = S.skills[sk], n = F.skillXpNeeded(sk, s.lvl);
      return `<div class="skill"><small><span>${esc(sk)}</span><b class="num">${s.lvl}</b></small><div class="bar"><i style="width:${pct(s.xp, n)}%;background:var(--frost)"></i></div></div>`;
    }).join("")}</div>`).join("");
    const pts = PERKS.pointsLeft(S);
    const skillsWithPerks = Object.keys(PERKS.TREES);
    perkSkill = perkSkill && skillsWithPerks.includes(perkSkill) ? perkSkill : skillsWithPerks.slice().sort((a, b) => S.skills[b].lvl - S.skills[a].lvl)[0];
    const perks = `<div class="panel"><h2>Perks ${pts > 0 ? `<span class="gold">· ${pts} to spend</span>` : ""}</h2><p class="sub">One perk point per level, like Skyrim. Pick a skill:</p>
      <div class="chips" style="flex-wrap:wrap">${skillsWithPerks.map((k) => { const n = PERKS.TREES[k].filter(([id]) => PERKS.rank(S, id)).length; return `<button class="chip ${k === perkSkill ? "on" : ""}" data-act="pskill" data-id="${esc(k)}">${esc(k)} ${S.skills[k].lvl}${n ? ` · ${n}` : ""}</button>`; }).join("")}</div>
      <div class="list" style="margin-top:8px">${PERKS.TREES[perkSkill].map(([id, name, ranks]) => {
        const r = PERKS.rank(S, id), p = PERKS.BY_ID[id], err = PERKS.canTake(S, id);
        return `<div class="item ${r ? "on" : ""}" style="flex-wrap:wrap"><div class="t">${esc(name)}${ranks > 1 ? ` <span class="num">${r}/${ranks}</span>` : r ? " ✓" : ""}<span>${esc(p.desc)}${r < ranks ? ` · needs ${esc(perkSkill)} ${p.req[r]}${p.needs.length ? ` and ${p.needs.map((n) => esc(PERKS.BY_ID[n].name)).join(" or ")}` : ""}` : ""}</span></div>
          ${r < ranks ? `<button class="btn sm ${err ? "" : "pri"}" data-act="perk" data-id="${id}" ${err ? "disabled" : ""}>Take</button>` : ""}</div>`; }).join("")}</div></div>`;
    const t = G.now(), fx = (S.fx || []).filter((f) => f.until > t);
    const effects = fx.length || G.rested(S) || S.poison ? `<div class="panel"><h2>Active effects</h2><div class="list">${G.rested(S) ? `<div class="item"><div class="t">${(S.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested"}<span>Skills improve ${Math.round((S.restBonus || 0.05) * 100)}% faster · ${Math.ceil((S.rested - t) / 60)} min left</span></div></div>` : ""}
      ${S.poison ? `<div class="item"><div class="t">${esc(S.poison.name)} on your weapon<span>${S.poison.hits} hit${S.poison.hits > 1 ? "s" : ""} left</span></div></div>` : ""}
      ${fx.map((f) => `<div class="item"><div class="t">${esc(f.name)} ${f.mag}<span>${Math.ceil((f.until - t) / 60)} min left</span></div></div>`).join("")}</div></div>` : "";
    const tnow = G.now(), rp = POWERS.RACE[S.race];
    const cd = (at) => { const m = Math.ceil(((at || 0) + POWERS.DAY - tnow) / 60); return m > 0 ? `ready in ${m} min` : "ready"; };
    const shoutRows = Object.entries(POWERS.SHOUTS).filter(([, [, words]]) => words.some((w) => POWERS.known(S, w))).map(([id, [name, words, cds, desc]]) => {
      const lv = POWERS.level(S, id);
      return `<div class="item" style="flex-wrap:wrap"><div class="t">${esc(name)} <span class="num">${words.map((w) => POWERS.known(S, w) ? (POWERS.unlocked(S, w) ? `<b>${w}</b>` : `${w}🔒`) : "···").join(" ")}</span><span>${esc(desc)}${lv ? ` · cooldown ${cds[lv - 1]} s` : ""}</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${words.filter((w) => POWERS.known(S, w) && !POWERS.unlocked(S, w)).map((w) => `<button class="btn sm" data-act="unlock" data-id="${w}" ${(S.souls || 0) > 0 ? "" : "disabled"}>Unlock ${w} (1 soul)</button>`).join("")}
        ${POWERS.ROAD_SHOUTS.includes(id) && lv ? `<button class="btn sm pri" data-act="roadshout" data-id="${id}" ${POWERS.voiceReady(S) ? "" : "disabled"}>Shout</button>` : ""}</div></div>`; }).join("");
    const fol = S.follower ? `<div class="panel"><h2>Follower</h2><div class="item"><div class="t">${esc(TOWNS.FOLLOWERS[S.follower.id][0])}<span>${Math.round(TOWNS.followerHp(S))}/${TOWNS.followerMax(S, S.follower.id)} health · fights beside you · carries 100 for you · goes down instead of dying</span></div><button class="btn sm" data-act="dismiss">Dismiss</button></div></div>` : "";
    const powersHtml = fol + `<div class="panel"><h2>Powers & shouts</h2><div class="list">
      <div class="item"><div class="t">${esc(rp[0])} <span class="num">${cd(S.powerAt)}</span><span>${esc(rp[1])} Once a day: put "Use my racial power" in your tactics.</span></div></div>
      <div class="item"><div class="t">${S.stone ? esc(POWERS.STONES[S.stone][0]) : "No standing stone"}${S.stone && POWERS.stoneHasPower(S) ? ` <span class="num">${cd(S.stonePowerAt)}</span>` : ""}<span>${S.stone ? esc(POWERS.STONES[S.stone][1]) : "Visit one of the 13 standing stones (Guardian Stones are near Riverwood) to take its blessing."}</span></div></div>
      ${shoutRows || `<p class="sub">No Words of Power yet. Word Walls wait at the end of Nordic barrows (Bleak Falls Barrow has one), and the Greybeards at High Hrothgar teach Unrelenting Force.</p>`}</div>
      <p class="sub" style="margin-top:8px">Dragon souls: <b>${S.souls || 0}</b>${S.dragons ? ` · dragons slain: ${S.dragons}` : ""}. Kill a dragon to absorb its soul; each soul unlocks one word.${!POWERS.voiceReady(S) ? ` Your voice recovers in ${Math.ceil(S.voiceAt - tnow)} s.` : ""}</p></div>`;
    return `${lvl}${effects}${powersHtml}<div class="panel"><h2>${esc(S.name)}</h2><p class="sub">Level ${S.level} ${esc(D.RACES[S.race].name)} · ${esc(D.RACES[S.race].desc)}</p>
      <div class="bar" style="margin-top:8px"><i style="width:${pct(S.charXp, need)}%;background:var(--gold)"></i></div><p class="sub num">${Math.round(S.charXp)}/${need} toward level ${S.level + 1}</p>
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:8px">
        <div class="slot">Health<b class="num" style="display:block">${G.maxHealth(S)}</b></div><div class="slot">Magicka<b class="num" style="display:block">${G.maxMagicka(S)}</b></div><div class="slot">Stamina<b class="num" style="display:block">${G.maxStamina(S)}</b></div></div>
      <p class="sub" style="margin-top:10px">Spells: ${S.spells.map((s) => esc(D.SPELLS[s].name)).join(", ")} · Power: ${esc(D.RACES[S.race].power)}${S.horse ? ` · Horse: ${esc(S.horse.name)}` : ""}</p>
      ${(S.words || []).length ? `<p class="sub">Words of Power: ${S.words.map(esc).join(", ")}</p>` : ""}
      ${groups}
      <p class="sub" style="margin-top:14px">Skills rise as you use them, with Skyrim's own rates.</p>
      <details style="margin-top:8px"><summary class="sub" style="cursor:pointer;min-height:36px">Start over</summary><p class="sub">Deletes this character for good.</p><button class="btn danger" data-act="wipe">Delete ${esc(S.name)}</button></details></div>${perks}`;
  }

  function panelPack() {
    const eq = G.equipment(S), eqIds = new Set(Object.values(eq).map((r) => r.id));
    const slotNames = { weapon: "Weapon", shield: "Shield", head: "Head", chest: "Chest", hands: "Hands", feet: "Feet" };
    const groups = {};
    for (const r of S.inv) {
      const it = D.ITEMS[r.item]; if (!it) continue;
      const g = { weapon: "Weapons", potion: "Potions", poison: "Poisons", scroll: "Scrolls", tome: "Spell tomes", soulgem: "Soul gems", ingredient: "Ingredients", trophy: "Trophies", material: "Crafting materials" }[it.slot] || "Armor";
      (groups[g] = groups[g] || []).push(r);
    }
    const canShop = S.location && G.shopTypes(S.location).length && G.shopsOpen();
    const enchanted = S.inv.filter((r) => D.ITEMS[r.item]?.enchant), gems = S.inv.filter((r) => D.ITEMS[r.item]?.slot === "soulgem");
    const row = (r) => {
      const it = D.ITEMS[r.item], open = packOpen === r.id, on = eqIds.has(r.id);
      const charge = it.enchant ? ` · ${Math.round(100 * (r.charge || 0) / it.enchant.capacity)}% charge` : "";
      const acts = [];
      if (G.SLOTS.includes(it.slot)) acts.push(on ? `<button class="btn sm" data-act="uneq" data-slot="${it.slot}">Take off</button>` : `<button class="btn sm pri" data-act="eq" data-id="${r.id}">Equip</button>`);
      if (it.slot === "tome") acts.push(`<button class="btn sm pri" data-act="read" data-id="${r.id}">Read</button>`);
      if (it.slot === "potion") acts.push(`<button class="btn sm pri" data-act="drinkrow" data-id="${r.id}">Drink</button>`);
      if (it.slot === "poison") acts.push(`<button class="btn sm pri" data-act="poison" data-id="${r.id}">Coat weapon</button>`);
      if (it.slot === "ingredient") acts.push(`<button class="btn sm" data-act="eat" data-id="${r.id}">Eat (learn an effect)</button>`);
      if (it.enchant && gems.length) acts.push(...gems.map((g) => `<button class="btn sm" data-act="recharge" data-id="${r.id}" data-gem="${g.id}">Recharge (${esc(D.ITEMS[g.item].name.split(" (")[0])})</button>`));
      if (canShop) acts.push(`<button class="btn sm" data-act="sell" data-id="${r.id}">Sell ${G.sellPrice(S, r)}g</button>`);
      const ingFx = it.slot === "ingredient" && TOWNS.INGREDIENT_FX[r.item] ? TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? e : "?").join(", ") : "";
      const qual = r.tq ? TOWNS.QUALITY[r.tq] + " " : "";
      return `<div class="item ${on ? "on" : ""}" data-act="packrow" data-id="${r.id}" style="flex-wrap:wrap"><div class="t">${esc(qual + it.name)}${r.qty > 1 ? ` ×${r.qty}` : ""}${on ? " ✓" : ""}${r.stolen ? ' <span class="danger-high">stolen</span>' : ""}<span>${esc(ingFx || G.itemStats(r.item))}${r.temper ? ` · +${r.temper} improved` : ""}${charge} · ${+(it.weight * r.qty).toFixed(2)} wt</span></div>
        ${open ? `<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${acts.join("") || '<span class="sub">Nothing to do with this here.</span>'}</div>` : ""}</div>`;
    };
    return `<div class="panel"><h2>Equipped · ${esc(S.loadout)}</h2><div class="slotgrid">${G.SLOTS.map((sl) => `<div class="slot"><span>${slotNames[sl]}</span>${eq[sl] ? esc(D.ITEMS[eq[sl].item].name) : "—"}</div>`).join("")}</div>
      <p class="sub" style="margin-top:8px">Carrying <span class="num">${G.carried(S).toFixed(1)}/${G.capacity(S)}</span>${G.overweight(S) ? " — too heavy to run" : ""} · ${S.gold} gold${enchanted.length ? ` · ${enchanted.length} enchanted` : ""}</p></div>
      <div class="panel"><h2>Pack</h2><p class="sub">Tap an item for options.${canShop ? " You're in town: you can sell here." : ""}</p>
      ${Object.entries(groups).map(([g, rows]) => `<h3 style="margin-top:12px">${g}</h3><div class="list">${rows.map(row).join("")}</div>`).join("") || '<p class="sub">Empty.</p>'}</div>`;
  }

  function panelTactics() {
    const L = G.loadout(S), rules = L.rules;
    const condOpts = Object.entries(D.CONDITIONS).map(([id, [label, p]]) => `<option value="${id}" ${tacticsDraft.if === id ? "selected" : ""}>${esc(label)}${p ? " …%" : ""}</option>`).join("");
    const actOpts = [...Object.entries(D.BASIC_ACTIONS).map(([id, l]) => [id, l]),
      ...S.spells.map((s) => [`spell:${s}`, `Cast ${D.SPELLS[s].name} (${G.spellCost(S, D.SPELLS[s])} magicka)`]),
      ...["health", "magicka", "stamina"].map((r) => [`potion:${r}`, `Drink a ${r} potion (have ${G.countRestore(S, r)})`]),
      ...[...new Set(S.inv.filter((r) => D.ITEMS[r.item]?.slot === "scroll").map((r) => r.item))].map((i) => [`scroll:${i}`, `Read ${D.ITEMS[i].name}`]),
      ["power:race", `Use ${POWERS.RACE[S.race][0]} (racial power, once a day)`],
      ...(POWERS.stoneHasPower(S) && S.stone !== "tower" ? [["power:stone", `Use ${POWERS.STONES[S.stone][0]}'s power (once a day)`]] : []),
      ...Object.keys(POWERS.SHOUTS).filter((id) => !POWERS.ROAD_SHOUTS.includes(id) && POWERS.level(S, id)).map((id) => [`shout:${id}`, `Shout ${POWERS.SHOUTS[id][0]} (${POWERS.level(S, id)} word${POWERS.level(S, id) > 1 ? "s" : ""})`])]
      .map(([id, l]) => `<option value="${esc(id)}" ${tacticsDraft.do === id ? "selected" : ""}>${esc(l)}</option>`).join("");
    const needPct = D.CONDITIONS[tacticsDraft.if]?.[1];
    const enemies = D.ENCOUNTERS.filter((e) => e.kind !== "event");
    return `<div class="panel"><h2>Tactics</h2><p class="sub">Every turn, the first rule that is true <b>and</b> affordable fires. If none fires, you attack. Power attacks cost 40 + 2 × weapon weight stamina (${F.powerAttackCost(G.equipment(S).weapon ? D.ITEMS[G.equipment(S).weapon.item].weight : 0)} now).</p>
      <div class="list">${rules.map((r, i) => { const d = G.describeRule(r); return `<div class="rule"><span class="n">${i + 1}</span><span>If <b>${esc(d.cond)}</b> → ${esc(d.act)}</span><span class="acts">
        <button class="iconbtn" style="width:36px;height:36px" data-act="rup" data-i="${i}" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button class="iconbtn" style="width:36px;height:36px" data-act="rdown" data-i="${i}" aria-label="Move down" ${i < rules.length - 1 ? "" : "disabled"}>↓</button><button class="iconbtn" style="width:36px;height:36px" data-act="rdel" data-i="${i}" aria-label="Remove">✕</button></span></div>`; }).join("") || '<p class="sub">No rules — you will just attack.</p>'}</div>
      <h3 style="margin-top:14px">Add a rule</h3>
      <div class="list"><select id="tc" aria-label="Condition">${condOpts}</select>
      ${needPct ? `<select id="tp" aria-label="Percent">${D.PERCENTS.map((p) => `<option ${tacticsDraft.pct === p ? "selected" : ""}>${p}</option>`).join("")}</select>` : ""}
      <select id="ta" aria-label="Action">${actOpts}</select>
      <button class="btn pri" data-act="radd" ${rules.length >= D.MAX_RULES ? "disabled" : ""}>Add rule</button></div>
      <h3 style="margin-top:14px">Presets</h3><div class="chips">${Object.entries(D.PRESETS).map(([id, p]) => `<button class="chip" data-act="preset" data-id="${id}">${esc(p.name)}</button>`).join("")}</div></div>
      <div class="panel"><h2>Test fight</h2><p class="sub">A practice fight at full health. Nothing is used up, and you can't die.</p>
      <div class="list"><select id="te" aria-label="Enemy">${enemies.map((e) => `<option>${esc(e.name)}</option>`).join("")}</select><button class="btn pri" data-act="test">Fight it</button></div>
      ${testResult ? `<p style="margin-top:10px"><b>${testResult.f.won ? "Victory" : "Defeat"}</b> against the ${esc(testResult.name)}.</p>${fightLog(testResult.f)}` : ""}</div>
      <div class="panel"><h2>Loadouts</h2><p class="sub">A loadout is gear + rules. Switch before a fight.</p>
      <div class="chips">${Object.keys(S.loadouts).map((n) => `<button class="chip ${n === S.loadout ? "on" : ""}" data-act="lo" data-name="${esc(n)}">${esc(n)}</button>`).join("")}</div>
      <div class="list"><input id="lon" maxlength="20" placeholder="New loadout name, e.g. Dragon" aria-label="New loadout name"><div class="grid2"><button class="btn" data-act="losave">Save current as</button><button class="btn danger" data-act="lodel">Delete ${esc(S.loadout)}</button></div></div></div>`;
  }

  function panelTown() {
    const l = S.location, types = l ? G.shopTypes(l) : [];
    if (!l || (!types.length && !TOWNS.isTown(l))) {
      if (l && (DUNGEONS.enterable(l) || POWERS.STONE_AT[l] || l === "High Hrothgar")) return placeHere();
      return `<div class="panel"><h2>${l ? esc(l) : "The wilds"}</h2><p class="sub">${l ? "There's nothing to buy here." : "You're out on the road."} Cities and towns have shops, inns, trainers, alchemy labs, forges and jobs.</p></div>`;
    }
    const open = G.shopsOpen(), wanted = TOWNS.wanted(S), hold = G.holdAt(WORLD.places[l]);
    const sections = [...types.filter((x) => x !== "stables"), ...(TOWNS.INNS[l] ? ["inn"] : []), ...(TOWNS.TRAINERS[l] ? ["train"] : []), "alchemy", ...(types.includes("blacksmith") ? ["forge"] : []), "jobs", "streets", ...(TOWNS.followersHere(S).length || l === "Whiterun" ? ["hire"] : []), ...(TOWNS.carriageFrom(l) ? ["carriage"] : []), ...(TOWNS.HOMES[l] ? ["home"] : []), ...(ENCH.hasEnchanter(l) ? ["enchanter"] : []), ...(types.includes("stables") ? ["stables"] : [])];
    townShop = sections.includes(townShop) ? townShop : sections[0];
    const names = { general: "General goods", blacksmith: "Blacksmith", wizard: "Court wizard", stables: "Stables", fence: "Ragged Flagon (fence)", inn: TOWNS.INNS[l] || "Inn", train: "Trainers", alchemy: "Alchemy lab", forge: "Forge", jobs: "Jobs", streets: "Streets", hire: l === "Whiterun" ? "Dragonsreach & hirelings" : "Hirelings", carriage: "Carriage", enchanter: "Arcane enchanter", home: TOWNS.home(S, l) ? `🏠 ${TOWNS.HOMES[l]?.[0]}` : `Buy ${TOWNS.HOMES[l]?.[0]}` };
    const fac = F.priceFactor(G.skill(S, "Mercantile"));
    let body = "", note = "";
    const shopRow = (i, sell = true) => { const p = G.buyPrice(S, i); return `<div class="item"><div class="t">${esc(D.ITEMS[i].name)}<span>${esc(G.itemStats(i))} · ${D.ITEMS[i].weight} wt</span></div><span class="num gold">${p}</span><button class="btn sm" data-act="buy" data-item="${esc(i)}" ${open && !wanted && S.gold >= p ? "" : "disabled"}>Buy</button></div>`; };
    if (townShop === "stables") body = `<div class="item"><div class="t">A horse<span>${D.HORSE_SPEED}× faster travel · +${D.HORSE_CARRY} carry weight · can die in an encounter</span></div><span class="num gold">${D.HORSE_PRICE}</span><button class="btn sm pri" data-act="buy" data-item="horse" ${open && !S.horse && !wanted ? "" : "disabled"}>${S.horse ? "Owned" : "Buy"}</button></div>`;
    else if (["general", "blacksmith", "wizard", "fence"].includes(townShop)) {
      note = `${open ? "Shops are open." : `Shops are closed for the night. They open at 08:00 (${esc(G.clockText())}).`} At Mercantile ${G.skill(S, "Mercantile")} you buy at about ${(fac / G.haggle(S)).toFixed(2)}× value. Sell from the Pack tab.${townShop === "fence" ? " The fence buys stolen goods." : ""}`;
      body = (D.SHOP_STOCK[townShop] || []).map((i) => shopRow(i)).join("");
    } else if (townShop === "inn") {
      note = "Sleep to heal fully and become Rested (skills improve 5% faster for 40 minutes; your own bed gives 10%). Buy a round and the locals talk.";
      body = `<div class="item"><div class="t">Rent a room<span>${G.rested(S) ? "You're already rested" : "Full health and Rested"}</span></div><span class="num gold">${TOWNS.roomPrice(S)}</span><button class="btn sm pri" data-act="inn" data-c="room" ${wanted ? "disabled" : ""}>Sleep</button></div>
        <div class="item"><div class="t">Buy a round, listen for rumours<span>Reveals ${G.P(S, "rumour_monger") ? "two places" : "a place"} you haven't found yet</span></div><span class="num gold">${G.P(S, "rumour_monger") ? 0 : TOWNS.RUMOUR}</span><button class="btn sm" data-act="inn" data-c="rumour">Listen</button></div>`;
    } else if (townShop === "train") {
      const n = TOWNS.trainedThisLevel(S);
      note = `Skyrim rules: 5 sessions per level (${5 - n} left), and trainers stop at 50 (common), 75 (expert) or 90 (master).`;
      body = TOWNS.TRAINERS[l].map(([who, sk, lvl]) => { const c = TOWNS.trainCost(S, sk), cur = S.skills[sk].lvl, ok = cur < TOWNS.CAP[lvl] && n < 5 && S.gold >= c && !wanted;
        return `<div class="item"><div class="t">${esc(who)}<span>${esc(sk)} ${cur} → ${cur + 1} · ${lvl} trainer (up to ${TOWNS.CAP[lvl]})</span></div><span class="num gold">${c}</span><button class="btn sm" data-act="train" data-id="${esc(who)}" ${ok ? "" : "disabled"}>Train</button></div>`; }).join("");
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
      note = `Improve weapons and armor. Each step uses one piece of the item's material, like Skyrim: Iron or Steel Ingots, Leather, Firewood for wooden bows, Refined Moonstone for Elven and Dwarven Metal for Dwarven gear. Blacksmiths sell the common ones; the rest turn up in dungeons. Your Smithing (${G.skill(S, "Smithing")}) sets how far: every 20 points allows one more quality level.`;
      const rows = S.inv.filter((r) => TOWNS.temperInfo(S, r));
      body = rows.map((r) => { const i = TOWNS.temperInfo(S, r);
        return `<div class="item"><div class="t">${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}<span>${i.block ? esc(i.block) : `→ ${TOWNS.QUALITY[i.q + 1]} (+${i.per} ${D.ITEMS[r.item].slot === "weapon" ? "damage" : "armor"}) · uses 1 ${esc(D.ITEMS[i.ingot].name)} (you have ${i.have})`}</span></div><button class="btn sm" data-act="temper" data-id="${r.id}" ${i.block ? "disabled" : ""}>Improve</button></div>`; }).join("") || '<p class="sub">Nothing to improve.</p>';
    } else if (townShop === "jobs") {
      const avail = TOWNS.jobsAt(S, l), mine = S.jobs || [];
      note = "New jobs every in-game day (2 real hours). You can hold three at once. Clearing and delivery jobs pay out by themselves when done.";
      body = `<h3>Your jobs</h3>${mine.length ? mine.map((j) => `<div class="item" style="flex-wrap:wrap"><div class="t">${esc(j.type === "clear" ? `Clear ${j.target}` : j.type === "deliver" ? `Deliver to ${j.target}` : `Bring ${j.n} ${D.ITEMS[j.item].name}`)}<span>${j.type === "gather" ? `You have ${TOWNS.countItem(S, j.item)}/${j.n} · ` : ""}from ${esc(j.town)} · ${j.reward} gold</span></div>
          ${j.type === "gather" ? `<button class="btn sm pri" data-act="handin" data-id="${esc(j.id)}" ${TOWNS.countItem(S, j.item) >= j.n ? "" : "disabled"}>Hand in</button>` : ""}<button class="btn sm" data-act="dropjob" data-id="${esc(j.id)}">Drop</button></div>`).join("") : '<p class="sub">None yet.</p>'}
        <h3 style="margin-top:12px">Notice board</h3>${avail.length ? avail.map((j) => `<div class="item"><div class="t">${esc(j.text)}<span>${j.reward} gold</span></div><button class="btn sm pri" data-act="takejob" data-id="${esc(j.id)}" ${mine.length >= 3 || wanted ? "disabled" : ""}>Take</button></div>`).join("") : '<p class="sub">Nothing new today.</p>'}`;
    } else if (townShop === "home") {
      const [hname, price, hdesc] = TOWNS.HOMES[l], h = TOWNS.home(S);
      if (!h) {
        note = `${hdesc} Skyrim price. Inside: a chest that keeps things safe even when you die, your own bed (Well Rested: skills +10%), and a garden.`;
        body = `<div class="item"><div class="t">${esc(hname)}<span>${l === "Whiterun" && !S.thaneWhiterun ? "Only for someone the Jarl trusts (bring Farengar the Dragonstone)" : "For sale"}</span></div><span class="num gold">${price}</span><button class="btn sm pri" data-act="buyhome" ${S.gold >= price && !wanted ? "" : "disabled"}>Buy</button></div>`;
      } else {
        note = "Your home. Things in the chest are safe even if you die on the road.";
        const pack = S.inv.filter((r) => !Object.values(G.loadout(S).equipment).includes(r.id));
        body = `<div class="item"><div class="t">Your bed<span>Full health and Well Rested (+10% skills for 40 min)</span></div><button class="btn sm pri" data-act="homebed">Sleep</button></div>
          <div class="item"><div class="t">Garden<span>${TOWNS.gardenReady(S) ? "Ripe: harvest ingredients" : `Growing. Ready in ${Math.ceil(((h.garden || 0) + 7200 - G.now()) / 60)} min`}</span></div><button class="btn sm" data-act="harvest" ${TOWNS.gardenReady(S) ? "" : "disabled"}>Harvest</button></div>
          <h3 style="margin-top:12px">Chest (${h.chest.length})</h3>${h.chest.length ? h.chest.map((r, i) => `<div class="item"><div class="t">${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}<span>${esc(G.itemStats(r.item))}</span></div><button class="btn sm" data-act="unstash" data-id="${i}">Take</button></div>`).join("") : '<p class="sub">Empty.</p>'}
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
    } else if (townShop === "carriage") {
      note = "Skyrim fares: 20 gold to a big city, 50 to a small hold capital. The carriage goes as fast as a horse, and nothing attacks you on the way.";
      body = TOWNS.carriageDests(S).map(({ n, price }) => { const mins = G.pxDist(WORLD.places[l], WORLD.places[n]) * 1.15 / TOWNS.CARRIAGE_SPEED;
        return `<div class="item"><div class="t">${esc(n)}<span>about ${fmtMin(mins)}</span></div><span class="num gold">${price}</span><button class="btn sm pri" data-act="carriage" data-id="${esc(n)}" ${S.gold >= price && !wanted ? "" : "disabled"}>Ride</button></div>`; }).join("");
    } else if (townShop === "hire") {
      note = "One follower at a time. They fight beside you, carry 100 weight for you, and heal between fights. If they take too much they go down and get back up after the fight, badly hurt; they never die. Hirelings cost 500 gold, like in Skyrim.";
      body = (l === "Whiterun" ? `<div class="item"><div class="t">Farengar, court wizard<span>${S.thaneWhiterun ? "Thanks you again for the Dragonstone." : "Wants the Dragonstone from Bleak Falls Barrow. The Jarl rewards whoever brings it."}</span></div>${S.thaneWhiterun ? "" : `<button class="btn sm pri" data-act="dragonstone" ${S.inv.some((r) => r.item === "dragonstone") ? "" : "disabled"}>Give it</button>`}</div>` : "")
        + TOWNS.followersHere(S).map(([id, [name, , cost, hp, dmg, desc]]) => `<div class="item"><div class="t">${esc(name)}<span>${esc(desc)} · ${TOWNS.followerMax(S, id)} health · hits for ~${Math.round(dmg * (1 + 0.05 * (S.level - 1)))}</span></div><span class="num gold">${cost || "free"}</span><button class="btn sm pri" data-act="hire" data-id="${id}" ${S.follower || S.gold < cost || wanted || (id === "lydia" && !S.thaneWhiterun) ? "disabled" : ""}>${S.follower?.id === id ? "With you" : "Hire"}</button></div>`).join("");
    } else if (townShop === "streets") {
      const b = TOWNS.bounty(S, hold);
      note = `Crime has a price: Skyrim bounties are 25 gold for pickpocketing, 40 for assault and 1000 for murder, per hold. Guards stop you when you come into a town where you're wanted.`;
      body = `<div class="item"><div class="t">Pick a pocket<span>Pickpocket ${G.skill(S, "Pickpocket")} · about ${Math.round(TOWNS.pickChance(S, { gold: 25, level: 10 }) * 100)}% chance · getting caught adds 25 gold bounty</span></div><button class="btn sm danger" data-act="pickpocket">Try</button></div>
        <div class="item"><div class="t">Your bounty in ${esc(hold)}<span>${b ? `${b} gold${wanted ? " · you resisted arrest: shops won't serve you" : ""}` : "Clean. For now."}</span></div>${b ? `<button class="btn sm" data-act="guardopen">Talk to a guard</button>` : ""}</div>
        <p class="sub" style="margin-top:8px">Stolen goods only sell to a fence: the Ragged Flagon in Riften, or anywhere with the Fence perk.</p>`;
    }
    return `<div class="panel"><h2>${esc(l)}</h2>${wanted ? `<p class="sub danger-high">You're wanted in ${esc(hold)}. Shops, inns and trainers turn you away.</p>` : ""}
      <div class="chips" style="flex-wrap:wrap">${sections.map((t) => `<button class="chip ${t === townShop ? "on" : ""}" data-act="shop" data-id="${t}">${esc(names[t])}</button>`).join("")}</div>
      ${note ? `<p class="sub" style="margin-top:8px">${note}</p>` : ""}<div class="list">${body}</div><p class="sub" style="margin-top:10px">You have <b class="gold">${S.gold} gold</b>.</p></div>`;
  }

  function panelLog() {
    const t = G.now(), me = livePos();
    const ppl = others.filter((o) => !o.hiding || G.pxDist(me, otherPos(o, t)) < MP.NEAR_PX).map((o) => ({ ...o, pos: otherPos(o, t) })).map((o) => ({ ...o, d: G.pxDist(me, o.pos) })).sort((a, b) => a.d - b.d);
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
          return `<div class="item" style="flex-wrap:wrap"><div class="t">${esc(o.name)}${inParty(o.id) ? " ⚑" : ""}<span>Level ${o.level} ${esc(D.RACES[o.race]?.name || "")} · ${esc(o.loc || G.holdAt(o.pos))}${o.moving ? " · travelling" : ""}${o.dungeon ? " · in a dungeon" : ""}${o.bounty ? ` · wanted (${o.bounty})` : ""}</span></div>
          <span class="num sub">${near ? "here" : o.d < 60 ? "nearby" : "~" + fmtMin(o.d * 1.1 / G.speed(S)) + " away"}</span>
          <div style="display:flex;gap:6px;width:100%;flex-wrap:wrap">${inParty(o.id) ? "" : `<button class="btn sm" data-act="invite" data-id="${esc(o.id)}">Invite</button>`}
          ${near && !inParty(o.id) ? `<button class="btn sm" data-act="pick" data-id="${esc(o.id)}">Pickpocket</button><button class="btn sm danger" data-act="attack" data-id="${esc(o.id)}">Attack</button>` : ""}</div></div>`; }).join("")}</div>
          <p class="sub" style="margin-top:8px">To rob or attack someone you must be in the same place. Fights use their gear and stats. Killing someone in a town is always seen; out in the wilds, sometimes.</p>`
        : `<p class="sub">No one else ${Store.mode === "p2p" ? "online right now. Send friends the app and they" : "yet. Share this page and friends"} appear here and on the map.</p>`)
      : APP ? `<p class="sub">This is the offline game: just you. Other players live in the online world.</p>${onlineBtn()}` : '<p class="sub">Shared saving isn\'t available in this view, so you\'re playing alone in this browser.</p>'}
      ${shared ? `<div class="item" style="margin-top:8px"><div class="t">🏹 Lie in ambush<span>${S.ambush ? "Hidden by the road. The next traveller to pass close by gets a sneak attack." : canAmbush ? "Hide here off the road (you must be standing in the wilds). You're hidden from the map." : "Stop somewhere in the wilds first."}</span></div><button class="btn sm ${S.ambush ? "danger" : ""}" data-act="ambush" ${canAmbush || S.ambush ? "" : "disabled"}>${S.ambush ? "Stop" : "Hide"}</button></div>` : ""}</div>`;
    const bnt = Object.entries(S.bounty || {}).filter(([, v]) => v > 0);
    const bounty = bnt.length ? `<div class="panel"><h2>Bounties</h2><div class="list">${bnt.map(([h, v]) => `<div class="item"><div class="t">${esc(h)}<span>${v} gold${(S.resisted || {})[h] ? " · resisted arrest" : ""}</span></div></div>`).join("")}</div><p class="sub" style="margin-top:6px">Pay it to a guard in that hold's towns, or to a bounty hunter on the road.</p></div>` : "";
    const word = shared ? `<div class="panel"><h2>Word on the road</h2>${news.length ? `<div class="log">${news.slice(0, 20).map((n) => `<div><time>${new Date(n.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${esc(n.text)}</div>`).join("")}</div>` : '<p class="sub">Quiet, for now.</p>'}</div>` : "";
    const worldHtml = Store.mode === "p2p" ? `<div class="panel"><h2>The world</h2>
      <p class="sub">Everyone with the app plays in this one world, straight from phone to phone. Every phone keeps a copy of it, so it lives on as long as anyone plays. Only people online right now appear here. To bring a friend in, send them the app.</p>
      <div class="item"><div class="t">${Store.peers ? `${Store.peers} other ${Store.peers === 1 ? "player" : "players"} online` : "Looking for other players…"}<span>${Store.peers ? `${Store.direct} linked straight to you${Store.peers > Store.direct ? `, ${Store.peers - Store.direct} reached through other players` : ""}` : "It can take up to a minute to find each other"}</span></div></div></div>` : "";
    return `${worldHtml}${partyHtml}${travellers}${bounty}${word}
      <div class="panel"><h2>Journal</h2><div class="log">${S.journal.map((j) => `<div><time>${new Date(j.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${esc(j.text)}</div>`).join("")}</div></div>`;
  }

  // ------------------------------------------------------------ panel events
  function onPanelInput(e) { if (e.target.id === "search") { searchText = e.target.value; const pos = e.target.selectionStart; renderPanel(true); const s = $("#search"); s.focus(); s.setSelectionRange(pos, pos); } }
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
    const say = (m) => { toast(m); persist(); renderPanel(true); if ($("#sky")) renderMenu(); };
    switch (a) {
      case "go": travelTo(b.dataset.place); renderPanel(true); break;
      case "unpick": selected = null; renderPicked(); break;
      case "stop": if (S.trip?.carriage) { toast("The driver won't stop until you get there."); break; } if (S.trip?.status === "travel" || S.trip?.status === "event") { [S.x, S.y] = livePos(); S.trip = null; S.location = Object.keys(WORLD.places).find((n) => G.pxDist([S.x, S.y], WORLD.places[n]) < 12) || null; persist(true); toast("You stop and look around."); } break;
      case "openenc": openEncounter(); break;
      case "openev": openEvent(); break;
      case "online": openOnline(); break;
      case "raidfight": raidFight(); break;
      case "skytab": sky.page = b.dataset.id; sky.cat = "all"; sky.sel = null; sky.sort = sky.page === "skills" ? "lvl" : "name"; sky.dir = 1; renderMenu(); break;
      case "skycat": sky.cat = b.dataset.id; sky.sel = null; renderMenu(); break;
      case "skysort": { const k = b.dataset.id; sky.dir = sky.sort === k ? -sky.dir : 1; sky.sort = k; renderMenu(); break; }
      case "skysel": { const id = isNaN(+b.dataset.id) ? b.dataset.id : +b.dataset.id; sky.sel = sky.sel === id ? null : id; renderMenu(); break; }
      case "skyclose": closeMenu(); break;
      case "skyperks": closeMenu(); perkSkill = b.dataset.id; tab = "hero"; bump(); renderTabs(); renderPanel(true); setTimeout(() => $("#side").scrollIntoView({ block: "start" }), 50); break;
      case "skytac": { const L = G.loadout(S); if (!inTactics(b.dataset.id)) L.rules.unshift({ if: "always", pct: 50, do: b.dataset.id }); say("Added to the top of your tactics: you'll use it whenever it's ready."); break; }
      case "skytacx": { const L = G.loadout(S); L.rules = L.rules.filter((r) => r.do !== b.dataset.id); say("Removed from your tactics."); break; }
      case "disench": say(ENCH.disenchant(S, +b.dataset.id)); break;
      case "enchant": { const m = ENCH.enchant(S, enchDraft.item, enchDraft.eff, enchDraft.gem); persist(true); renderPanel(true); showMessage("Arcane enchanter", m); publishCard(); break; }
      case "stone": say(POWERS.takeStone(S, b.dataset.id)); publishCard(); break;
      case "carriage": { const err = TOWNS.rideCarriage(S, b.dataset.id); if (err) return toast(err); S.trip.total = G.minutesLeft(S); persist(true); toast(`The driver cracks the reins. ${fmtMin(S.trip.total)} to ${b.dataset.id}.`); tab = "map"; renderTabs(); renderPanel(true); $("#mapwrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); follow = true; break; }
      case "hire": say(TOWNS.hire(S, b.dataset.id)); publishCard(); break;
      case "buyhome": { const m = TOWNS.buyHome(S); persist(true); renderPanel(true); showMessage("A home of your own", m); break; }
      case "homebed": say(TOWNS.sleepHome(S)); break;
      case "harvest": say(TOWNS.harvest(S)); break;
      case "stash": say(TOWNS.stash(S, +b.dataset.id)); publishCard(); break;
      case "unstash": say(TOWNS.unstash(S, +b.dataset.id)); publishCard(); break;
      case "dismiss": say(TOWNS.dismiss(S)); publishCard(); break;
      case "dragonstone": { const m = TOWNS.deliverDragonstone(S); persist(true); renderPanel(true); showMessage("Dragonsreach", m); break; }
      case "greybeards": { const m = POWERS.greybeards(S); persist(true); renderPanel(true); showMessage("High Hrothgar", m); break; }
      case "unlock": say(POWERS.unlock(S, b.dataset.id)); break;
      case "roadshout": { const m = POWERS.roadShout(S, b.dataset.id); liveCache.key = ""; persist(true); toast(m); renderPanel(true); break; }
      case "enter": { const err = DUNGEONS.enter(S); if (err) return toast(err); selected = null; renderPicked(); dunNote = null; persist(true); renderDungeon(); break; }
      case "dun": renderDungeon(); break;
      case "droom": dungeonRoom(b.dataset.c); break;
      case "dact": dungeonAct(b.dataset.c); break;
      case "dmin": closeDungeon(); tab = "pack"; renderTabs(); renderPanel(true); break;
      case "dleave": { const m = DUNGEONS.leave(S); dunNote = null; persist(true); closeDungeon(); renderPanel(true); showMessage("Back outside", m); break; }
      case "ev": eventAction(b.dataset.c); break;
      case "evbuy": { const m = G.buyFrom(S, b.dataset.item); persist(); openEvent(m); break; }
      case "enc": encounterAction(b.dataset.a); break;
      case "close": closeModal(); break;
      case "lvl": say(G.levelUp(S, b.dataset.a)); publishCard(); break;
      case "wipe": Store.wipe().then(() => { S = null; tabsEl.classList.add("hide"); location.reload(); }); break;
      case "packrow": if (!e.target.closest("button")) { packOpen = packOpen === +b.dataset.id ? null : +b.dataset.id; renderPanel(true); } break;
      case "eq": say(G.equip(S, +b.dataset.id)); break;
      case "uneq": G.unequip(S, b.dataset.slot); say("Taken off."); break;
      case "read": say(G.readTome(S, +b.dataset.id)); break;
      case "drink": say(G.drinkPotion(S)); break;
      case "recharge": say(G.recharge(S, +b.dataset.id, +b.dataset.gem)); break;
      case "sell": packOpen = null; say(G.sell(S, +b.dataset.id, 1)); break;
      case "buy": say(G.buy(S, b.dataset.item, 1)); break;
      case "shop": townShop = b.dataset.id; renderPanel(true); break;
      case "pskill": perkSkill = b.dataset.id; renderPanel(true); break;
      case "perk": say(PERKS.take(S, b.dataset.id)); publishCard(); break;
      case "drinkrow": packOpen = null; say(TOWNS.drink(S, +b.dataset.id)); publishCard(); break;
      case "poison": packOpen = null; say(TOWNS.applyPoison(S, +b.dataset.id)); break;
      case "eat": packOpen = null; say(TOWNS.eat(S, +b.dataset.id)); break;
      case "inn": say(b.dataset.c === "room" ? TOWNS.rentRoom(S) : TOWNS.rumour(S)); break;
      case "train": say(TOWNS.train(S, b.dataset.id)); publishCard(); break;
      case "alch": { const id = +b.dataset.id; alchSel = alchSel.includes(id) ? alchSel.filter((x) => x !== id) : [...alchSel, id].slice(-3); renderPanel(true); break; }
      case "brew": { const r = TOWNS.brew(S, alchSel); alchSel = []; persist(); renderPanel(true); showMessage("Alchemy", r.text + ((r.skills || []).length ? " 📈 " + r.skills.join(" · ") : "")); break; }
      case "temper": say(TOWNS.temper(S, +b.dataset.id)); publishCard(); break;
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
      case "rup": case "rdown": { const i = +b.dataset.i, j = a === "rup" ? i - 1 : i + 1; [L.rules[i], L.rules[j]] = [L.rules[j], L.rules[i]]; persist(); renderPanel(true); break; }
      case "rdel": L.rules.splice(+b.dataset.i, 1); persist(); renderPanel(true); break;
      case "radd": { const r = { if: tacticsDraft.if, do: tacticsDraft.do }; if (D.CONDITIONS[r.if][1]) r.pct = tacticsDraft.pct; L.rules.push(r); persist(); renderPanel(true); break; }
      case "preset": L.rules = G.clone(D.PRESETS[b.dataset.id].rules); say(`${D.PRESETS[b.dataset.id].name} tactics loaded. Rules for spells you don't know are skipped.`); break;
      case "test": {
        const name = $("#te").value, e2 = G.scaleEnemy(D.ENCOUNTERS.find((x) => x.name === name), S.level);
        const sim = G.clone(S); sim.health = G.maxHealth(sim); sim.healthTs = G.now(); sim._test = true;
        const f = new G.Fight(sim, e2); f.run();
        testResult = { f, name }; renderPanel(true); break;
      }
      case "lo": if (S.trip?.status === "encounter") return toast("Not in the middle of a fight!"); S.loadout = b.dataset.name; say(`Switched to ${S.loadout}.`); break;
      case "losave": { const n = ($("#lon").value || "").trim().slice(0, 20); if (!n) return toast("Give it a name first."); say(G.saveLoadoutAs(S, n)); break; }
      case "lodel": say(G.deleteLoadout(S, S.loadout)); break;
    }
  }

  boot().catch((err) => { console.error(err); app.innerHTML = `<div class="panel" style="margin-top:24px"><h2>Something went wrong</h2><p class="sub">${esc(err.message)}</p></div>`; });
}
