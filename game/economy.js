/* A real economy. [OURS] Skyrim's prices never move; here every town has its own.
   What sets a price in a town (multiplied together, then held between 0.5× and 1.8× of the item's value):
   - Regional goods: ore is cheap by the mines and dear where there are none, fish and grain cheap in farm towns,
     magic cheap in Winterhold, and so on.
   - Today's market: each in-game day every town has one thing in short supply (dearer) and one glut (cheaper),
     worked out from the date so every phone agrees.
   - Caravans: while a caravan stands in town, and for a day after it leaves, what it carried is cheaper there.
   - Players: everything bought pushes that item's price up in that town, everything sold pushes it down.
     Each player keeps one shared record per town ("econ", per-player so nobody overwrites anybody), and the
     push fades by half every in-game day.
   Guards against abuse:
   - One player's push in a town is capped, so you can't move a market alone, and bulk lots get dearer (or pay less)
     with every unit, so dumping 200 of something doesn't pay 200× the first price.
   - Selling to a merchant never pays more than 90% of what they'd charge you for it, whatever your perks.
   - Other players' records are checked and clamped before they count.
   Trade goods (ore, ingots, leather, pelts, food, ingredients) are traded "wholesale": the merchant's cut shrinks
   less steeply with Mercantile than for gear, so a skilled trader can make money running them between towns. */
const ECON = (() => {
  const DAY = 7200;                              // one in-game day in real seconds (time runs 12× faster)
  const CATS = ["ore", "metal", "leather", "food", "ingredient", "potion", "weapon", "armor", "magic", "gem", "ammo"];
  const LABEL = { ore: "ore", metal: "ingots", leather: "leather & pelts", food: "food", ingredient: "ingredients", potion: "potions", weapon: "weapons", armor: "armour", magic: "magic goods", gem: "gems & jewellery", ammo: "arrows & bolts", other: "odds and ends" };
  const TRADE = new Set(["ore", "metal", "leather", "food", "ingredient"]);
  const MIN = 0.5, MAX = 1.8, PUSH = 0.3;

  function catOf(id) {
    const it = (typeof D !== "undefined" && D.ITEMS[id]) || {}, s = it.slot || "";
    if (s === "weapon") return "weapon";
    if (["head", "chest", "hands", "feet", "shield"].includes(s)) return "armor";
    if (s === "ingredient") return "ingredient";
    if (/^ore_/.test(id)) return "ore";
    if (/^(mat_(iron|steel|silver|gold|corundum|moonstone|quicksilver|malachite|orichalcum|ebony|dwarven|ingot)|ingot_)/.test(id) || /ingot/i.test(it.name || "")) return "metal";
    if (/^pelt_|leather|hide|strips/.test(id)) return "leather";
    if (/^(gem_|.*_(ring|necklace|circlet|amulet)$)/.test(id) || s === "ring" || s === "neck" || s === "amulet") return "gem";
    if (s === "food" || /^food_|^fish_|^meal_/.test(id)) return "food";
    if (s === "ingredient") return "ingredient";
    if (s === "potion" || s === "poison") return "potion";
    if (s === "ammo") return "ammo";
    if (s === "weapon") return "weapon";
    if (["head", "chest", "hands", "feet", "shield"].includes(s)) return "armor";
    if (["tome", "scroll", "soulgem", "staff"].includes(s)) return "magic";
    return "other";
  }
  const isTrade = (id) => TRADE.has(catOf(id)) && !/^dish_/.test(id);   // cooked meals sell like any other goods

  /* regional goods: <1 cheap here, >1 dear here */
  const REGION = {
    Markarth: { ore: 0.65, metal: 0.8, food: 1.2, leather: 1.1 },
    Karthwasten: { ore: 0.7, food: 1.2 },
    Whiterun: { food: 0.75, weapon: 0.9, magic: 1.15, ore: 1.15 },
    Riverwood: { metal: 0.85, food: 0.85, gem: 1.2 },
    Solitude: { gem: 0.85, magic: 0.9, ore: 1.3, food: 1.1 },
    Windhelm: { gem: 0.9, ingredient: 0.85, ore: 1.2, leather: 1.15 },
    Riften: { food: 0.75, potion: 0.85, ingredient: 0.9, weapon: 1.15, metal: 1.15 },
    Winterhold: { magic: 0.75, potion: 0.9, weapon: 1.3, armor: 1.2, food: 1.35 },
    Dawnstar: { ore: 0.7, metal: 0.9, food: 1.15, ingredient: 1.2 },
    Falkreath: { leather: 0.7, food: 0.9, gem: 1.25, magic: 1.2 },
    Morthal: { ingredient: 0.7, potion: 0.9, metal: 1.25, ore: 1.3 },
    Rorikstead: { food: 0.7, metal: 1.2 },
    "Dragon Bridge": { leather: 0.85, food: 0.9 },
    Ivarstead: { food: 0.85, leather: 0.85, gem: 1.2 },
    Kynesgrove: { ore: 0.7, food: 1.15 },
    "Shor's Stone": { ore: 0.7 },
    "Darkwater Crossing": { ore: 0.7 },
    "Raven Rock": { ore: 0.75, food: 1.4, metal: 0.85, magic: 1.1 },
    Skaal: { leather: 0.7, food: 1.2, metal: 1.3 },
  };
  function region(town, cat) {
    const r = REGION[town] || {};
    if (r[cat]) return r[cat];
    if (cat === "ore" && typeof SMITH !== "undefined" && SMITH.MINES && SMITH.MINES[town]) return 0.75;
    return 1;
  }

  // ---- today's market (same on every phone)
  function seeded(str) { let a = 7; for (const ch of String(str)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
  const dayOf = (t) => Math.floor(t / DAY);
  function today(town, t = G.now()) {
    const r = seeded(town + "|" + dayOf(t)), short = CATS[Math.floor(r() * CATS.length)];
    let glut = CATS[Math.floor(r() * CATS.length)]; if (glut === short) glut = CATS[(CATS.indexOf(short) + 3) % CATS.length];
    return { short, glut, ends: (dayOf(t) + 1) * DAY };
  }

  // ---- caravans bring goods
  function caravanGoods(town, t = G.now()) {
    if (typeof CARAVANS === "undefined" || !CARAVANS.all) return [];
    const out = [];
    for (const c of CARAVANS.all(t)) {
      const fresh = (c.phase === "stop" && c.from === town) || (c.phase === "road" && c.from === town && t - c.depart < DAY);
      if (fresh) out.push({ name: c.line.name, goods: CARAVANS.stock ? CARAVANS.stock(c) : [], here: c.phase === "stop" });
    }
    return out;
  }
  function caravanFactor(town, item, cat, t) {
    let f = 1;
    for (const c of caravanGoods(town, t)) {
      if (c.goods.includes(item)) f = Math.min(f, 0.85);
      else if (c.goods.some((g) => catOf(g) === cat)) f = Math.min(f, 0.93);
    }
    return f;
  }

  // ---- what players bought and sold: per-player records, id `${uid}|${town}`, f: {item: [q, t]}
  const docs = new Map(), dirty = new Set();
  let byTown = new Map(), flushT = null;
  const depth = (item) => { const v = Math.max(1, ((typeof D !== "undefined" && D.ITEMS[item]) || {}).value || 1); return Math.max(2, Math.round(40 / Math.pow(v, 0.4))); };
  const fade = (dt) => Math.pow(0.5, Math.max(0, dt) / DAY);
  function clean(d) {   // a record from someone else: only sane numbers count
    if (!d || typeof d.uid !== "string" || typeof d.town !== "string" || !d.f || typeof d.f !== "object") return null;
    const f = {};
    for (const [k, v] of Object.entries(d.f).slice(0, 80)) {
      if (!Array.isArray(v) || !Number.isFinite(+v[0]) || !Number.isFinite(+v[1])) continue;
      const cap = depth(k); f[k] = [Math.max(-cap, Math.min(cap, +v[0])), +v[1]];
    }
    return { uid: d.uid, town: d.town, f };
  }
  function reindex() {
    byTown = new Map();
    for (const d of docs.values()) { if (!byTown.has(d.town)) byTown.set(d.town, []); byTown.get(d.town).push(d); }
  }
  /* the shared feed (Store.watch("econ")): our own unsent changes win */
  function set(list) {
    for (const raw of list || []) {
      const id = raw.id || (raw.uid + "|" + raw.town);
      if (dirty.has(id)) continue;
      const d = clean(raw); if (d) docs.set(id, d);
    }
    reindex();
  }
  function pressure(town, item, t = G.now()) {
    let p = 0;
    for (const d of byTown.get(town) || []) { const e = d.f[item]; if (e) p += e[0] * fade(t - e[1]); }
    return p;
  }
  /* a purchase (+qty) or sale (−qty) by a player in a town */
  function record(uid, town, item, qty, t = G.now()) {
    if (!uid || !town || !item || !qty) return;
    const id = uid + "|" + town, d = docs.get(id) || { uid, town, f: {} }, cap = depth(item);
    const e = d.f[item], q = (e ? e[0] * fade(t - e[1]) : 0) + qty;
    d.f[item] = [Math.round(Math.max(-cap, Math.min(cap, q)) * 100) / 100, Math.round(t)];
    for (const [k, v] of Object.entries(d.f)) if (Math.abs(v[0] * fade(t - v[1])) < 0.05) delete d.f[k];   // faded away
    docs.set(id, d); dirty.add(id); reindex();
    clearTimeout(flushT); flushT = setTimeout(flush, 1500);
  }
  function flush() {
    if (typeof Store === "undefined" || !Store.put) { dirty.clear(); return; }
    for (const id of [...dirty]) { const d = docs.get(id); dirty.delete(id); if (d) Store.put("econ", id, { uid: d.uid, town: d.town, f: d.f }); }
  }

  /* the price multiplier for an item in a town. extra = units already in this lot (bulk buys/sales) */
  function mult(town, item, side = "buy", extra = 0, t = G.now()) {
    if (!town) return 1;
    const cat = catOf(item), day = today(town, t);
    const daily = day.short === cat ? 1.3 : day.glut === cat ? 0.8 : 1;
    const p = pressure(town, item, t) + extra, push = 1 + PUSH * Math.tanh(p / depth(item));
    return Math.max(MIN, Math.min(MAX, region(town, cat) * daily * caravanFactor(town, item, cat, t) * push));
  }
  /* why a price is what it is, for the little arrows at the merchant */
  function info(town, item, t = G.now()) {
    const cat = catOf(item), day = today(town, t), why = [], m = mult(town, item, "buy", 0, t);
    const reg = region(town, cat); if (reg < 1) why.push(`local ${LABEL[cat]}`); else if (reg > 1) why.push(`${LABEL[cat]} are scarce here`);
    if (day.short === cat) why.push("short supply today"); if (day.glut === cat) why.push("a glut today");
    if (caravanFactor(town, item, cat, t) < 1) why.push("a caravan brought some");
    const p = pressure(town, item, t), d = depth(item);
    if (p > d * 0.3) why.push("players are buying it up"); else if (p < -d * 0.3) why.push("players have been selling it");
    return { m, why, trend: m >= 1.12 ? "up" : m <= 0.9 ? "down" : "" };
  }
  const badge = (town, item) => {
    if (!town) return "";
    const i = info(town, item); if (!i.trend) return "";
    const pct = Math.round((i.m - 1) * 100);
    return `<span class="econ-b econ-${i.trend}" title="${(pct > 0 ? "+" : "") + pct}%: ${i.why.join(", ")}">${i.trend === "up" ? "▲" : "▼"}${Math.abs(pct)}%</span>`;
  };

  /* the merchant's cut for trade goods: Mercantile 0 → 2.15× (gear: 3.3×), 100 → 1.5× (gear: 2×) */
  const tradeFactor = (pf) => 1 + (pf - 1) * 0.5;

  /* towns where things are bought and sold */
  function towns() { return typeof D !== "undefined" ? Object.keys(D.SHOPS || {}).filter((t) => (D.SHOPS[t] || []).some((k) => k !== "stables") && (typeof WORLD === "undefined" || WORLD.places[t])) : []; }
  /* where to sell what you carry, and what to run from here: [{item, buy, sell, to, profit}] */
  function routes(s, from = s.location, n = 3, t = G.now()) {
    if (!from) return [];
    const stock = (G.shopStock(from) || []).filter((i) => D.ITEMS[i] && !D.ITEMS[i].noTrade && i !== "horse" && isTrade(i)), out = [];
    for (const item of stock) {
      const b = G.buyPrice(s, item, from); let best = null;
      for (const to of towns()) if (to !== from) { const p = G.sellPrice(s, { item }, to); if (!best || p > best.p) best = { p, to }; }
      if (best && best.p - b >= Math.max(2, b * 0.05)) out.push({ item, buy: b, sell: best.p, to: best.to, profit: best.p - b });
    }
    return out.sort((a, b) => b.profit / Math.max(0.1, D.ITEMS[b.item].weight || 0.1) - a.profit / Math.max(0.1, D.ITEMS[a.item].weight || 0.1)).slice(0, n);
  }
  function bestPlace(s, row, t = G.now()) {   // the best town to sell this
    let best = null;
    for (const to of towns()) { const p = G.sellPrice(s, row, to); if (!best || p > best.p) best = { p, to }; }
    return best;
  }

  /* the "Market today" card above a merchant's goods */
  function report(s, town = s.location, t = G.now()) {
    if (!town) return "";
    const day = today(town, t), r = REGION[town] || {}, cheap = Object.keys(r).filter((k) => r[k] < 1), dear = Object.keys(r).filter((k) => r[k] > 1);
    if (typeof SMITH !== "undefined" && SMITH.MINES && SMITH.MINES[town] && !cheap.includes("ore") && !r.ore) cheap.push("ore");
    const cv = caravanGoods(town, t), rt = routes(s, town);
    const hrs = Math.max(1, Math.round((day.ends - t) * 12 / 3600));
    const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    return `<details class="econ-card"><summary> <b>Market today</b> · <span class="econ-up">▲ ${LABEL[day.short]}</span> · <span class="econ-down">▼ ${LABEL[day.glut]}</span></summary>
      <p class="sub">Short of <b>${LABEL[day.short]}</b> (dearer), plenty of <b>${LABEL[day.glut]}</b> (cheaper) for about ${hrs} more hours.</p>
      ${cheap.length || dear.length ? `<p class="sub">${cheap.length ? `Cheap here: ${cheap.map((c) => LABEL[c]).join(", ")}. ` : ""}${dear.length ? `Dear here: ${dear.map((c) => LABEL[c]).join(", ")}.` : ""}</p>` : ""}
      ${cv.map((c) => `<p class="sub"> ${esc(c.name)} ${c.here ? "is in town" : "just left"}: ${c.goods.map((g) => esc(D.ITEMS[g]?.name || g)).join(", ")} are cheaper.</p>`).join("")}
      ${rt.length ? `<p class="sub"><b>Trade runs from here:</b></p><div class="econ-routes">${rt.map((x) => `<div>${esc(D.ITEMS[x.item].name)}: buy ${x.buy}, sell in ${esc(x.to)} for ${x.sell} <b class="gold">+${x.profit}</b></div>`).join("")}</div>`
        : `<p class="sub">No trade runs pay from here yet. Ore, ingots, pelts, food and ingredients can be run between towns once your Mercantile is high enough.</p>`}
      <p class="sub">Everything players buy pushes a price up here, everything sold pushes it down; it fades over a day or two.</p></details>`;
  }

  return { DAY, CATS, LABEL, REGION, catOf, isTrade, region, today, caravanGoods, depth, pressure, record, set, flush, mult, info, badge, tradeFactor, towns, routes, bestPlace, report, _docs: docs };
})();
