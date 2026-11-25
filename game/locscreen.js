/* locscreen.js: arriving somewhere opens the place full screen. [OURS]
   The Area tab used to be a plain list. Now any place on the map (city, town, farm, camp, fort, cave mouth, shrine,
   standing stone...) opens as a painted scene: the place's name in a big title, its hold and a short line about it,
   the time and weather, and signposts standing on the picture for everything you can do there (blacksmith, inn,
   general goods, jarl, notice board, caravans, gathering...). Each signpost says in a few words what's going on
   (open / closed, a job to hand in, a caravan in town). Tapping one opens the same screen the Area tab always had;
   its ‹ button brings you back to the scene. People here (other players, your follower, the townsfolk you can talk to)
   sit as small portraits along the bottom.
   - Keyboard: arrows or WASD walk between signposts, Enter opens one, Esc closes an open card, then leaves to the map.
   - Phones (or a short window): the signposts turn into a readable list over the lower half of the picture.
   - "List" switches back to the old Area board (remembered per player); the board has a "Scene" button back.
   - The landscape button next to the name opens the place's arrival picture again (locintro.js).
   - Signpost positions are data: POS[place] (percent of the 16:9 painting) wins over KIND_POS[kind], and anything
     left over takes the next free SLOT. Drop a painted scene for a place in later and give it its own POS row.
   ui.js decides when the scene is up (Area tab, standing at a place, no shop open) and hands in what's there;
   this file only lays it out. Nothing here changes game rules. Tested in tests/test_locscreen.js. */
const LOCSCREEN = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function" && typeof window !== "undefined";   // (node tests stub a bare document)
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };
  /* shown names come from the names table (names.js); l and hold stay ids (data-place, layouts, pictures) */
  const PN = (n) => (typeof NAMES !== "undefined" ? NAMES.place(n) : n), HN = (n) => (typeof NAMES !== "undefined" && n ? NAMES.hold(n) : n);
  const AU = () => (typeof AREAUI !== "undefined" ? AREAUI : null);

  // ------------------------------------------------------------ backdrops
  /* painted cities and towns (place-<slug>.webp) */
  const PLACE_PICS = ["whiterun", "solitude", "windhelm", "riften", "markarth", "falkreath", "morthal", "dawnstar", "winterhold", "riverwood", "ravenrock"];
  /* closest painted backdrop per kind of place (until a scene of its own is painted) */
  const KIND_PIC = { city: "bs-town", town: "bs-town", farm: "bs-autumn", fort: "bs-fort", camp: "bs-banditcamp", lair: "bs-lair", stone: "bs-tundra", shrine: "bs-temple", landmark: "bs-rocky", dungeon: "bs-cave" };
  /* a dungeon's theme picks its own fight backdrop */
  const THEME_PIC = { barrow: "bs-barrow", temple: "bs-temple", cave: "bs-cave", mine: "bs-mine", dwemer: "bs-dwemer", vampire: "bs-vampire", lair: "bs-lair", giantcamp: "bs-giantcamp",
    camp: "bs-banditcamp", bandit: "bs-banditcamp", forsworn: "bs-forsworn", fort: "bs-fort", thalmor: "bs-thalmor", falmer: "bs-cave", ash: "bs-ash" };
  /* inside a roof of stone: no sky, so no rain or snow on the picture */
  const INDOOR = /^bs-(barrow|temple|cave|mine|dwemer|vampire)$/;
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  function kindOf(l) {
    const p = typeof WORLD !== "undefined" && WORLD.places[l];
    if (p && p[2]) return p[2];
    return typeof TOWNS !== "undefined" && safe(() => TOWNS.isTown(l), false) ? "town" : "landmark";
  }
  const themeOf = (l) => safe(() => (typeof DUNGEONS !== "undefined" && DUNGEONS.info(l)?.theme) || (WORLD.placeThemes?.[l] || [])[0] || "", "");
  /* picture names for a place, best first (each one a .webp next to index.html) */
  function backdrop(l) {
    const out = [], k = kindOf(l), s = slug(l), th = themeOf(l);
    if (PLACE_PICS.includes(s)) out.push("place-" + s);
    if ((k === "dungeon" || k === "camp" || k === "lair") && THEME_PIC[th]) out.push(THEME_PIC[th]);
    if (k === "camp" && /giant|basin|kiss|tree camp|bilegulch/i.test(l)) out.push("bs-giantcamp");
    if (k === "shrine" && /meridia|statue/i.test(l)) out.push("bs-rocky");
    if (KIND_PIC[k]) out.push(KIND_PIC[k]);
    const bio = typeof ASSETS !== "undefined" ? safe(() => ASSETS.biomeKey(l), null) : null;
    if (bio) out.push(bio);
    out.push("bs-town");
    return [...new Set(out)];
  }

  // ------------------------------------------------------------ words
  const FLAVOUR = {
    Whiterun: "Dragonsreach looks down over the plains and the Bannered Mare.", Solitude: "The capital on its stone arch, ships in the bay below.",
    Windhelm: "Old grey stone, older grudges, snow on every roof.", Riften: "Canals, autumn leaves, and someone's hand in your purse.",
    Markarth: "A city carved into the cliffs by the Dwemer.", Falkreath: "A quiet town among the pines, and a very big graveyard.",
    Morthal: "Mist off the marsh and stilted houses on the water.", Dawnstar: "Mines, a harbour, and folk who sleep badly.",
    Winterhold: "What the sea left of a great city, under the College.", Riverwood: "A mill, a smithy and the river running past.",
    "Raven Rock": "A Dunmer port on Solstheim, under the ash.",
  };
  const KIND_LINE = { city: "One of the great cities of Skyrim.", town: "A small town on the road.", farm: "Fields, a farmhouse and people who work them.", fort: "Old walls, and whoever holds them now.",
    camp: "Tents, a fire pit and watchful eyes.", lair: "Bones on the rocks. Something big lives here.", stone: "An old standing stone humming with power.", shrine: "A shrine where travellers leave offerings.",
    landmark: "A place worth a look.", dungeon: "A way down into the dark." };
  const KIND_NAME = { city: "City", town: "Town", farm: "Farm", fort: "Fort", camp: "Camp", lair: "Lair", stone: "Standing stone", shrine: "Shrine", landmark: "Landmark", dungeon: "Dungeon" };
  /* the place's own signpost (non-town places) */
  const MAIN = { dungeon: ["Entrance", ""], camp: ["The camp", ""], lair: ["The lair", ""], fort: ["Fort gate", ""], farm: ["Farmhouse", ""],
    stone: ["Standing stone", "⟡"], shrine: ["Shrine", ""], landmark: ["Look around", ""], town: ["Look around", ""], city: ["Look around", ""] };
  /* sheets: things that open as a card on the scene instead of a whole screen */
  const SHEET = { main: null, gather: ["Gathering", "", "Plants in reach"], news: ["Town crier", "", "News and rumours"], camp: ["Campfire", "", "Cook, fish, hunt"],
    hunt: ["Legendary beast", "", "A contract nearby"] };
  const PEOPLE_ROLES = ["hire", "inn", "blacksmith", "general", "wizard", "alchemy", "stables", "notice"];

  // ------------------------------------------------------------ positions (percent of the 16:9 painting)
  /* A signpost is ~170 px wide and ~85 px tall, so on the street plan they sit on a grid of 7 columns (x 13..87) and
     6 rows (y 28..83); the title owns the top middle. Keep x within 13..87 so nothing is cut off on a 16:10 screen.
     defaults for each kind of place: the same street plan works for any town until it has its own row */
  const TOWN_POS = {
    home: [13, 28], homes: [25, 28], halls: [75, 28], mine: [87, 28],
    homestead: [13, 39], train: [25, 39], wizard: [38, 39], hire: [50, 39], hall: [62, 39], enchanter: [75, 39], alchemy: [87, 39],
    blacksmith: [13, 50], forge: [25, 50], market: [38, 50], notice: [50, 50], jobs: [62, 50], inn: [75, 50], cook: [87, 50],
    stables: [13, 61], general: [25, 61], news: [50, 61], streets: [62, 61], fish: [87, 61],
    carriage: [13, 72], gather: [25, 72], caravans: [87, 72] };
  const SITE_POS = { main: [50, 50], gather: [25, 72], camp: [75, 72], hunt: [87, 50], news: [50, 72] };
  const KIND_POS = { city: TOWN_POS, town: TOWN_POS, farm: SITE_POS, dungeon: SITE_POS, camp: SITE_POS, fort: SITE_POS, lair: SITE_POS, stone: SITE_POS, shrine: SITE_POS, landmark: SITE_POS };
  /* A place with its own painted scene gets its own row here, same format, merged over its kind's defaults:
       POS["Whiterun"] = { hire: [50, 34], blacksmith: [18, 58] }   // Dragonsreach up the hill, Warmaiden's by the gate
     ids are the Area tab's section ids (inn, general, blacksmith, hire = jarl / longhouse, notice, caravans...) plus the
     cards: main (a non-town place's own panel), gather, news, camp, hunt. */
  const POS = {};
  /* free spots for anything without a place of its own (row by row, the title's corner left out) */
  const COLS = [13, 25, 38, 50, 62, 75, 87], ROWS = [28, 39, 50, 61, 72, 83];
  const SLOTS = [];
  for (const y of [50, 61, 39, 72, 28, 83]) for (const x of COLS) if (!(y < 34 && x > 30 && x < 70)) SLOTS.push([x, y]);
  const near = (a, b) => Math.abs(a[0] - b[0]) < 11.5 && Math.abs(a[1] - b[1]) < 10.5;
  /* ids → { id: [x, y] }, no two signposts on top of each other */
  function layout(l, ids, kind = kindOf(l)) {
    const want = { ...(KIND_POS[kind] || KIND_POS.landmark), ...(POS[l] || {}) }, used = [], out = {};
    const take = (id, p) => { out[id] = p; used.push(p); };
    for (const id of ids) { const p = want[id]; if (p && !used.some((u) => near(u, p))) take(id, p); }
    for (const id of ids) {
      if (out[id]) continue;
      const p = SLOTS.find((s) => !used.some((u) => near(u, s))) || [COLS[used.length % 7], ROWS[(used.length / 7 | 0) % 6]];
      take(id, p);
    }
    return out;
  }

  // ------------------------------------------------------------ what's here
  function caravanStatus(l) {
    if (typeof CARAVANS === "undefined") return null;
    return safe(() => { const c = CARAVANS.at(l); const here = c.find((x) => x.here); if (here) return { text: "Caravan here", hot: true };
      return c.length ? { text: "Arriving soon" } : null; }, null);
  }
  /* o: {S, l, sections, names, open, hold, sheets:{id: html}} → signposts [{id, label, icon, text, dim, hot, warn, sheet, group}] */
  function spots(o) {
    const A = AU(), { S, l } = o, sections = o.sections || [], names = o.names || {}, sheets = o.sheets || {}, kind = kindOf(l);
    const ready = A && A.readyHere ? A.readyHere(S, l, sections) : [], hot = new Set(ready.map((x) => x.go.shop));
    const out = [];
    const grouped = A ? A.group(sections) : [["", "", sections]];
    for (const [g, , ids] of grouped) for (const id of ids) {
      const st = (id === "caravans" && caravanStatus(l)) || (A ? A.status(S, l, id, o) : { text: "" });
      out.push({ id, label: A ? A.label(id, names) : names[id] || id, icon: (A && A.ICON[id]) || "•", text: st.text || "", dim: !!st.dim || !!st.closed, hot: !!st.hot || hot.has(id), warn: !!st.warn, group: g });
    }
    for (const [id, html] of Object.entries(sheets)) {
      if (!html) continue;
      const def = id === "main" ? [...(MAIN[kind] || MAIN.landmark), mainLine(S, l, kind)] : SHEET[id] || [id, "•", ""];
      out.push({ id, label: def[0], icon: def[1], text: def[2] || "", sheet: true, hot: id === "gather" || id === "hunt", group: "here" });
    }
    return out;
  }
  function mainLine(S, l, kind) {
    if (kind === "dungeon" || kind === "camp" || kind === "lair") return safe(() => (DUNGEONS.enterable(l) ? (DUNGEONS.refillLeft(S, l) ? "Cleared for now" : "Go inside") : "Look around"), "Look around");
    if (kind === "stone") return safe(() => (POWERS.STONE_AT[l] || []).includes(S.stone) ? "Your stone" : "Take its blessing", "");
    return { shrine: "Leave an offering", farm: "Work, trade, rest", fort: "See who holds it" }[kind] || "What's here";
  }
  /* people here: other players at this place first, then your follower, then the townsfolk behind the signposts */
  function people(o) {
    const { S, l } = o, out = [];
    for (const p of (o.players || []).slice(0, 6)) out.push({ name: p.name || "Traveller", sub: p.sub || "Player", pic: `<span class="ls-pi">${esc(String(p.name || "?").slice(0, 1).toUpperCase())}</span>`, player: true });
    if (S && S.follower && typeof NPCART !== "undefined") out.push({ name: S.follower.name || "Follower", sub: "Follower", pic: safe(() => NPCART.follower(S.follower.id, 40), "") });
    if (typeof NPCART !== "undefined") {
      const seen = new Set();
      for (const id of PEOPLE_ROLES) {
        if (!(o.sections || []).includes(id)) continue;
        const n = safe(() => NPCART.who(l, id), null); if (!n || !n.name || seen.has(n.name)) continue;
        seen.add(n.name);
        out.push({ name: n.name, sub: n.title || "", pic: safe(() => NPCART.portrait(n, 40), ""), shop: id });
        if (out.length >= 10) break;
      }
    }
    return out;
  }

  // ------------------------------------------------------------ mode (scene or the old list), per player
  const KEY = (S) => "ux_locmode_" + ((S && S.id) || "x");
  function mode(S) { try { return localStorage.getItem(KEY(S)) === "list" ? "list" : "scene"; } catch { return "scene"; } }
  function setMode(S, m) { try { localStorage.setItem(KEY(S), m === "list" ? "list" : "scene"); } catch { /* storage blocked */ } }
  /* the place to show, or "" (not standing at a real place, on the road, in a dungeon) */
  const placeOf = (S) => (S && S.location && !S.trip && !S.dungeon && typeof WORLD !== "undefined" && WORLD.places[S.location] ? S.location : "");

  // ------------------------------------------------------------ time and weather
  function tod(hour) { return hour >= 21 || hour < 5 ? "night" : hour < 8 ? "dawn" : hour >= 18 ? "dusk" : "day"; }
  function sky(l, hold) {
    const h = safe(() => G.clock().hour, 12), wx = safe(() => WEVENTS.weatherAt(hold || G.holdAt(WORLD.places[l])), null);
    return { tod: tod(h), clock: safe(() => G.clockText(G.now()), ""), wx: wx ? wx.id : "clear", wxName: wx ? wx.name : "" };
  }

  // ------------------------------------------------------------ the scene
  let sheetOpen = "", sheetAt = "";
  /* o: {S, l, sections, names, open, hold, sheets, players, wanted} → HTML for #locs */
  function html(o) {
    const { S, l } = o, kind = kindOf(l), hold = o.hold || safe(() => G.holdAt(WORLD.places[l]), "");
    if (sheetAt !== l) { sheetOpen = ""; sheetAt = l; }
    const sp = spots(o), pos = layout(l, sp.map((x) => x.id), kind), pics = backdrop(l), sk = sky(l, hold);
    const indoor = INDOOR.test(pics.find((p) => !/^place-/.test(p)) || "") && !/^place-/.test(pics[0]);
    if (sheetOpen && !(o.sheets || {})[sheetOpen]) sheetOpen = "";
    const bg = pics.map((p) => `url("${p}.webp")`).join(",");
    const GRP = { inn: "Inn", market: "Market", services: "Services & trainers", work: "Work & jobs", home: "Your home", events: "Events & fun", here: "Here" };
    let lastG = null;
    const pins = sp.map((x) => {
      const [px, py] = pos[x.id], head = x.group !== lastG ? `<li class="ls-gh" aria-hidden="true">${esc(GRP[x.group] || "")}</li>` : ""; lastG = x.group;
      const act = x.sheet ? `data-act="locsheet" data-id="${esc(x.id)}" aria-expanded="${sheetOpen === x.id}"` : `data-act="shop" data-id="${esc(x.id)}"`;
      return `${head}<li class="ls-li" style="--x:${px}%;--y:${py}%"><button class="ls-spot${x.dim ? " dim" : ""}${x.hot ? " hot" : ""}${x.warn ? " warn" : ""}${sheetOpen === x.id ? " on" : ""}" ${act} aria-label="${esc(x.label)}: ${esc(x.text)}"><span class="ls-ic" aria-hidden="true">${esc(x.icon)}</span><span class="ls-tx"><b>${esc(x.label)}</b><small>${esc(x.text)}</small></span>${x.hot ? '<i class="ls-dot" aria-hidden="true"></i>' : ""}</button></li>`;
    }).join("");
    const ppl = people(o).map((p) => p.shop ? `<button class="ls-who" data-act="shop" data-id="${esc(p.shop)}" title="${esc(p.sub)}"><span class="ls-wp" aria-hidden="true">${p.pic}</span><span class="ls-wn">${esc(p.name)}</span></button>`
      : `<span class="ls-who${p.player ? " pl" : ""}" title="${esc(p.sub)}"><span class="ls-wp" aria-hidden="true">${p.pic}</span><span class="ls-wn">${esc(p.name)}</span></span>`).join("");
    const sheets = Object.entries(o.sheets || {}).filter(([, h]) => h).map(([id, h]) => `<section class="ls-sheet" data-sheet="${esc(id)}" ${sheetOpen === id ? "" : "hidden"} aria-label="${esc(id)}"><button class="ls-x" data-act="locsheet" data-id="" aria-label="Close">✕</button>${h}</section>`).join("");
    const flav = FLAVOUR[l] || KIND_LINE[kind] || "";
    return `<div class="ls ls-${esc(kind)} tod-${sk.tod} wx-${esc(sk.wx)}${indoor ? " indoor" : ""}${sheetOpen ? " sheet-on" : ""}" data-place="${esc(l)}" role="region" aria-label="${esc(PN(l))}">
      <div class="ls-stage"><div class="ls-bg" style='background-image:${bg}'></div><div class="ls-tint"></div><div class="ls-wx" aria-hidden="true"></div></div>
      <ul class="ls-spots" role="list">${pins}</ul>
      <header class="ls-head"><div class="ls-tt"><small class="ls-hold"><span>${esc(KIND_NAME[kind] || "")}</span> · <span>${esc(HN(hold))}</span></small><div class="ls-nrow"><i aria-hidden="true"></i><h1 class="ls-name">${esc(PN(l))}</h1>${typeof LOCINTRO !== "undefined" ? LOCINTRO.viewBtn() : ""}</div><p class="ls-flav">${esc(flav)}</p>${o.wanted ? `<div class="ls-wanted">${o.wanted}</div>` : ""}</div>
        <div class="ls-meta"><span class="ls-clock">${esc(sk.clock)}</span>${sk.wxName ? `<span class="ls-wxn">${esc(sk.wxName)}</span>` : ""}${S ? `<span class="ls-gold"><b class="gold">${S.gold}</b> gold</span>` : ""}</div>
        <div class="ls-btns"><button class="btn ls-list" data-act="locmode" data-id="list" aria-label="Show as a list"><span>List</span></button><button class="btn pri ls-leave" data-act="locleave"><span>Leave</span></button></div></header>
      ${ppl ? `<footer class="ls-people" aria-label="People here">${ppl}</footer>` : ""}
      ${sheets}</div>`;
  }
  /* the button on the old board that brings the scene back */
  const sceneBtn = () => `<button class="btn sm ls-scenebtn" data-act="locmode" data-id="scene"><span>Scene view</span></button>`;

  // ------------------------------------------------------------ browser: mount, keys, parallax
  let root = null;
  function el() {
    if (!live) return null;
    if (!root || !root.isConnected) { root = document.getElementById("locs"); if (!root) { root = document.createElement("div"); root.id = "locs"; document.body.appendChild(root); } }
    return root;
  }
  /* show the scene (or hide it with ""). Keeps keyboard focus on the same signpost across redraws. */
  let lastHtml = "";
  function show(h) {
    const r = el(); if (!r) return;
    if (!h) { if (lastHtml) { r.innerHTML = ""; lastHtml = ""; } r.hidden = true; document.body.classList.remove("locs-on"); return; }
    const ae = document.activeElement, focusId = r.contains(ae) ? ae.dataset.id : null;
    if (h !== lastHtml) {
      /* a redraw (clock tick, gold changed...) keeps the drifting picture, the list's and the open card's scroll */
      const oldBg = r.querySelector(".ls-bg"), keep = {}; r.querySelectorAll(".ls-spots, .ls-sheet:not([hidden])").forEach((x) => { keep[x.className + (x.dataset.sheet || "")] = x.scrollTop; });
      const t = document.createElement("template"); t.innerHTML = h;
      const nb = t.content.querySelector(".ls-bg");
      if (oldBg && nb && oldBg.getAttribute("style") === nb.getAttribute("style") && r.querySelector(".ls")?.dataset.place === t.content.querySelector(".ls")?.dataset.place) nb.replaceWith(oldBg);
      r.replaceChildren(t.content); lastHtml = h;
      r.querySelectorAll(".ls-spots, .ls-sheet:not([hidden])").forEach((x) => { const v = keep[x.className + (x.dataset.sheet || "")]; if (v) x.scrollTop = v; });
    }
    r.hidden = false; document.body.classList.add("locs-on");
    fitBottom();
    if (focusId != null) { const b = r.querySelector(`.ls-spot[data-id="${CSS.escape(focusId)}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  const isOpen = () => !!(root && !root.hidden && lastHtml);
  /* the scene stops above the nav bar (phones) or the bottom bar (PC map) so they stay in reach */
  function fitBottom() {
    const r = el(); if (!r) return;
    let bot = 0;
    for (const t of document.querySelectorAll(".tabs, #pcbar, .pcbar")) { if (!t.offsetParent && getComputedStyle(t).position !== "fixed") continue; const q = t.getBoundingClientRect(); if (q.height && q.bottom >= innerHeight - 2 && q.top > innerHeight / 2 && getComputedStyle(t).display !== "none" && getComputedStyle(t).visibility !== "hidden") bot = Math.max(bot, innerHeight - q.top); }
    r.style.setProperty("--ls-bot", Math.round(bot) + "px");
  }
  function openSheet(id) {
    sheetOpen = id || "";
    const r = el(); if (!r) return;
    r.querySelectorAll(".ls-sheet").forEach((s) => { s.hidden = s.dataset.sheet !== sheetOpen; });
    r.querySelectorAll(".ls-spot[data-act=locsheet]").forEach((b) => { const on = b.dataset.id === sheetOpen; b.classList.toggle("on", on); b.setAttribute("aria-expanded", on); });
    r.querySelector(".ls")?.classList.toggle("sheet-on", !!sheetOpen);
    const s = sheetOpen && r.querySelector(`.ls-sheet[data-sheet="${CSS.escape(sheetOpen)}"]`);
    if (s) { s.scrollTop = 0; (s.querySelector("button:not(.ls-x), [data-act]:not(.ls-x)") || s.querySelector(".ls-x"))?.focus({ preventScroll: true }); }
    else if (id === "" && lastSpot) r.querySelector(`.ls-spot[data-id="${CSS.escape(lastSpot)}"]`)?.focus({ preventScroll: true });
  }
  let lastSpot = "";
  /* back / Esc: an open card closes first */
  function closeSheet() { if (!isOpen() || !sheetOpen) return false; openSheet(""); return true; }
  /* clicks routed here by ui.js: data-act locsheet / locmode / locleave. h: {S, leave, refresh} */
  function act(b, h) {
    const a = b.dataset.act;
    if (a === "locsheet") { if (b.dataset.id) lastSpot = b.dataset.id; openSheet(b.dataset.id === sheetOpen ? "" : b.dataset.id); return true; }
    if (a === "locmode") { setMode(h.S, b.dataset.id); h.refresh(); return true; }
    if (a === "locleave") { sheetOpen = ""; h.leave(); return true; }
    return false;
  }
  /* arrows / WASD: walk to the nearest signpost in that direction */
  const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
  function pick(from, list, dir) {
    let best = null, bd = Infinity;
    for (const c of list) {
      const dx = c.x - from.x, dy = c.y - from.y, along = dx * dir[0] + dy * dir[1];
      if (along <= 2) continue;
      const side = Math.abs(dx * dir[1] + dy * dir[0]), d = along + side * 2.2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  if (live) {
    window.addEventListener("keydown", (e) => {   // window capture, added at load: before the PC map's own WASD panning (pcmap.js)
      if (!isOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "") || e.target?.isContentEditable) return;
      if (document.querySelector("#modal, #sky, .lvlpick, #tbf")) return;   // something on top of the scene has the keys
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, dir = DIRS[k];
      if (e.key === "Escape" && sheetOpen) { e.preventDefault(); e.stopImmediatePropagation(); openSheet(""); return; }
      if (!dir || sheetOpen) return;
      const btns = [...root.querySelectorAll(".ls-spot, .ls-who[data-act]")].filter((b) => b.offsetParent);
      if (!btns.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const cur = btns.includes(document.activeElement) ? document.activeElement : null;
      if (!cur) { btns[0].focus(); return; }
      const c = (b) => { const q = b.getBoundingClientRect(); return { b, x: q.left + q.width / 2, y: q.top + q.height / 2 }; };
      const nx = pick(c(cur), btns.filter((b) => b !== cur).map(c), dir);
      if (nx) { nx.b.focus(); nx.b.scrollIntoView({ block: "nearest" }); }
    }, true);
    /* the picture drifts a little with the mouse (PC) */
    document.addEventListener("pointermove", (e) => {
      if (!isOpen() || e.pointerType !== "mouse") return;
      const bgEl = root.querySelector(".ls-bg"); if (!bgEl) return;
      bgEl.style.setProperty("--mx", ((e.clientX / innerWidth - 0.5) * -14).toFixed(1) + "px");
      bgEl.style.setProperty("--my", ((e.clientY / innerHeight - 0.5) * -8).toFixed(1) + "px");
    }, { passive: true });
    if (typeof window !== "undefined") window.addEventListener("resize", () => { if (isOpen()) fitBottom(); });
  }

  return { PLACE_PICS, KIND_PIC, THEME_PIC, KIND_POS, TOWN_POS, SITE_POS, POS, COLS, ROWS, SLOTS, near, FLAVOUR, KIND_LINE, KIND_NAME, MAIN, SHEET, kindOf, backdrop, layout, spots, people, mode, setMode, placeOf, tod, sky, html, sceneBtn,
    show, isOpen, closeSheet, openSheet, act, pick, get sheet() { return sheetOpen; } };
})();
if (typeof module !== "undefined") module.exports = LOCSCREEN;
