/* Homesteads: build your own house on open land, Hearthfire-style (our own plots and names). [OURS, Skyrim-inspired]
   - Three plots: Pinewatch Hollow (Falkreath), Fenhollow Rise (Morthal), Frostcairn Rest (Dawnstar). Buy the deed from
     the Jarl's steward in that town ([Skyrim] 5000 gold), then build in stages:
       small house → main hall → three wings (pick from armory, library, greenhouse, kitchen, trophy room,
       enchanter's tower, alchemy tower, storage room). A wing is for good, so choose.
   - Building eats materials kept at the plot: sawn logs (sawmill), quarried stone (quarry, needs a pickaxe), clay (clay
     pit), and parts you make at the plot's workbench from your own Iron Ingots and Firewood: nails, hinges, locks, iron
     fittings and glass (quartz from the quarry). Like the forge, everything you use is gone.
   - A steward (one per plot) can be hired once the small house stands. At home they keep up to 3 days of what the wings
     make and sell you building materials; or take them along as a follower (then the wings only keep 1 day).
   - Every wing makes something once an in-game day (arrows, study, ingredients, meals, visitors' gold, soul gems,
     potions) or, for the storage room, keeps 30 things safe even if you die.
   - Perks (perkfx.js): Carpenter (Smithing, fewer materials), Woodsman (Athletics, more from gathering),
     Landed Thane (Etiquette, cheaper deeds and stewards), Estate Income (Mercantile, gold from every wing).
   Lives in the save as s.homestead[plotId]. The screen is a town section in the plot's town (ui.js asks
   HOMESTEAD.sections / names / townHTML / act). */
const HOMESTEAD = (() => {
  const DAY = 2 * 3600;                 // one in-game day in real seconds (time runs 12x)
  const HOUR = DAY / 24;
  const GATHER_CD = HOUR;               // [OURS] each of sawmill / quarry / clay pit once an in-game hour
  const WING_SLOTS = 3;                 // [Skyrim] Hearthfire: three wings per house
  const STORE_CAP = 30;
  const STEWARD_FEE = 500;
  const RESTED = 8 * 2 * 3600 / 24;     // same as an inn: 8 in-game hours
  const PLOTS = {
    pinewatch: { name: "Pinewatch Hollow", town: "Falkreath", price: 5000, look: "lake", desc: "A clearing above a still lake, ringed by tall pines. Good timber all around.",
      steward: ["Hrolfa Pine-Hand", 130, 10, "Your steward at Pinewatch Hollow. Swings an axe at trees and bandits alike."] },
    fenhollow: { name: "Fenhollow Rise", town: "Morthal", price: 5000, look: "marsh", desc: "A dry rise above the Hjaalmarch fens. Fog in the mornings, clay underfoot.",
      steward: ["Corvin Reedwalker", 110, 12, "Your steward at Fenhollow Rise. Knows a few spells and every path through the marsh."] },
    frostcairn: { name: "Frostcairn Rest", town: "Dawnstar", price: 5000, look: "coast", desc: "A windy shelf over the Sea of Ghosts. Hard stone, cold nights, a view of the ice.",
      steward: ["Ulfgar Salt-Beard", 150, 11, "Your steward at Frostcairn Rest. An old sailor with a heavy hammer."] },
  };
  const BY_TOWN = Object.fromEntries(Object.entries(PLOTS).map(([id, p]) => [p.town, id]));
  const stewardId = (pid) => "hs_" + pid;
  // stewards are followers like any other (engine.js fights with TOWNS.FOLLOWERS). Their "home" is the plot, not a
  // town, so they never turn up in a town's hireling list; you hire them at the homestead.
  if (typeof TOWNS !== "undefined") for (const [pid, p] of Object.entries(PLOTS)) TOWNS.FOLLOWERS[stewardId(pid)] = [p.steward[0], p.name, STEWARD_FEE, p.steward[1], p.steward[2], p.steward[3]];

  // building materials kept at the plot: [name, icon]
  const MATS = { log: ["Sawn logs", "🪵"], stone: ["Quarried stone", "🪨"], clay: ["Clay", "🟫"], quartz: ["Quartz", "💎"],
    nails: ["Nails", "📌"], hinge: ["Hinges", "🔩"], lock: ["Locks", "🔒"], fittings: ["Iron fittings", "⚙"], glass: ["Glass", "🪟"] };
  // the workbench: part → [how many you get, inventory items used, plot stock used]
  const BENCH = {
    nails: [20, { mat_iron: 1 }, {}], hinge: [2, { mat_iron: 1 }, {}], lock: [1, { mat_iron: 1 }, {}],
    fittings: [2, { mat_iron: 1 }, {}], glass: [1, { mat_firewood: 1 }, { quartz: 2 }],
  };
  // stages: id → [name, what it gives, materials]
  const STAGES = {
    small: ["Small house", "A snug one-room house: a bed (Well Rested), a cooking fire and a door that locks. Lets you hire a steward.",
      { log: 12, stone: 6, clay: 4, nails: 20, hinge: 2, lock: 1, fittings: 2 }],
    hall: ["Main hall", "A long hall with a big hearth and a table for guests. Opens three spaces for wings.",
      { log: 24, stone: 16, clay: 10, nails: 40, hinge: 4, lock: 1, fittings: 6, glass: 2 }],
  };
  // wings: id → [name, what it does, materials]
  const WINGS = {
    armory: ["Armory", "Weapon racks and a grindstone. Every in-game day: 12 steel arrows.", { log: 10, stone: 14, nails: 20, fittings: 6, lock: 1 }],
    library: ["Library", "Shelves of books and a reading chair. Every in-game day: a session of study in one of your skills.", { log: 16, stone: 6, nails: 30, hinge: 2, glass: 3 }],
    greenhouse: ["Greenhouse", "Planters under glass. Every in-game day: 6 ingredients (Green Thumb doubles them).", { log: 10, stone: 4, clay: 8, glass: 8, fittings: 2 }],
    kitchen: ["Kitchen", "An oven, a larder and a pot that's always on. Every in-game day: 2 hot meals.", { log: 12, stone: 8, clay: 8, nails: 20, fittings: 2 }],
    trophy: ["Trophy room", "Mounted heads and dragon bones. Visitors pay to look: 20 gold a day, +10 for each dragon you've slain (up to 150).", { log: 14, stone: 8, nails: 30, hinge: 2, fittings: 4 }],
    enchanter: ["Enchanter's tower", "A tall tower with a soul-trap circle. Every in-game day: 1 filled Common Soul Gem.", { log: 8, stone: 20, clay: 6, glass: 2, fittings: 4, lock: 1 }],
    alchemy: ["Alchemy tower", "A tower full of retorts and drying herbs. Every in-game day: 2 potions.", { log: 8, stone: 18, clay: 6, glass: 4, fittings: 2 }],
    storage: ["Storage room", "Chests and barrels. Keeps 30 things safe even if you die, and the other wings keep 2 more days of goods.", { log: 18, stone: 6, nails: 30, hinge: 4, lock: 2 }],
  };
  const GREEN = ["ing_blue_flower", "ing_lavender", "ing_wheat", "ing_garlic", "ing_red_flower", "ing_purple_flower", "ing_juniper", "ing_snowberries", "ing_tundra_cotton", "ing_thistle"];
  const MEALS = ["dish_veg_soup", "dish_venison_stew", "dish_horker_stew", "dish_salmon_steak", "dish_fish_soup"];
  const POTIONS = ["potion_health", "potion_magicka", "potion_stamina"];

  const fx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const itemName = (id) => D.ITEMS[id]?.name || id;
  const all = (s) => (s.homestead = s.homestead || {});
  const plot = (s, pid) => all(s)[pid] || null;
  const owned = (s) => Object.keys(all(s)).filter((k) => PLOTS[k]);
  const here = (s) => BY_TOWN[s.location] || null;
  const wanted = (s) => typeof TOWNS !== "undefined" && TOWNS.wanted && TOWNS.wanted(s);
  const count = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
  function consume(s, item, n) {
    for (const r of [...s.inv].filter((x) => x.item === item)) { if (n <= 0) break; const k = Math.min(n, r.qty); G.take(s, r.id, k); n -= k; }
  }
  const deedPrice = (s) => Math.round(5000 * (1 - Math.min(0.5, fx(s, "hsdeed"))));
  const stewardFee = (s) => Math.round(STEWARD_FEE * (1 - Math.min(0.5, fx(s, "hsdeed"))));
  /* materials after the Carpenter perk (never below 1) */
  const need = (s, mats) => Object.fromEntries(Object.entries(mats).map(([k, n]) => [k, Math.max(1, Math.ceil(n * (1 - Math.min(0.5, fx(s, "hsmats")))))]));
  const missing = (h, mats) => Object.entries(mats).filter(([k, n]) => (h.stock[k] || 0) < n).map(([k, n]) => `${n - (h.stock[k] || 0)} ${MATS[k][0].toLowerCase()}`);
  const wingsOf = (h) => (h?.wings || []);
  const stage = (h) => (!h ? 0 : h.hall ? 2 : h.small ? 1 : 0);
  const stewardHome = (s, pid) => !!plot(s, pid)?.steward && s.follower?.id !== stewardId(pid);
  const keepDays = (s, pid) => { const h = plot(s, pid); return 1 + (stewardHome(s, pid) ? 2 : 0) + (wingsOf(h).includes("storage") ? 2 : 0); };

  // ---------------------------------------------------------------- deed
  function buyDeed(s, t = now()) {
    const pid = here(s); if (!pid) return { err: "There's no land for sale here." };
    const p = PLOTS[pid];
    if (plot(s, pid)) return { err: `You already own ${p.name}.` };
    if (wanted(s)) return { err: "The steward won't sell land to a wanted criminal." };
    const price = deedPrice(s);
    if (s.gold < price) return { err: `The deed to ${p.name} costs ${price} gold. You have ${s.gold}.` };
    s.gold -= price;
    all(s)[pid] = { t, small: 0, hall: 0, wings: [], stock: {}, cd: {}, col: {}, store: [], steward: false };
    G.note(s, `🏡 Bought the deed to ${p.name} near ${p.town}.`);
    return { title: p.name, text: `The Jarl's steward hands you the deed to ${p.name} for ${price} gold. Cut logs at the sawmill, dig stone and clay, make nails and hinges at the workbench, then raise a small house.` };
  }

  // ---------------------------------------------------------------- gathering at the plot
  const GATHER = {
    saw: ["Sawmill", "log", [4, 6], null, "You feed pine trunks through the sawmill"],
    quarry: ["Quarry", "stone", [3, 5], "pickaxe", "You break stone out of the quarry"],
    clay: ["Clay pit", "clay", [2, 4], null, "You dig wet clay out of the pit"],
  };
  const cdLeft = (h, k, t = now()) => Math.max(0, (h.cd[k] || 0) + GATHER_CD - t);
  function gather(s, pid, k, t = now()) {
    const h = plot(s, pid), g = GATHER[k]; if (!h || !g) return { err: "You don't own land here." };
    if (s.location !== PLOTS[pid].town) return { err: `${PLOTS[pid].name} is near ${PLOTS[pid].town}.` };
    const left = cdLeft(h, k, t); if (left > 0) return { err: `The ${g[0].toLowerCase()} needs a rest. Again in ${Math.ceil(left / 60)} min.` };
    if (g[3] && !count(s, g[3])) return { err: `You need a ${itemName(g[3]).toLowerCase()} for the quarry. Blacksmiths sell them.` };
    const n = Math.round(rint(g[2][0], g[2][1]) * (1 + fx(s, "hsyield")));
    h.stock[g[1]] = (h.stock[g[1]] || 0) + n; h.cd[k] = t;
    let extra = "";
    if (k === "quarry" && Math.random() < 0.35) { const q = Math.round(rint(1, 2) * (1 + fx(s, "hsyield"))); h.stock.quartz = (h.stock.quartz || 0) + q; extra = ` and ${q} quartz`; }
    const ups = G.useSkill(s, "Athletics", 12);
    return { text: `${g[4]}: +${n} ${MATS[g[1]][0].toLowerCase()}${extra}.${ups.length ? " " + ups.join(". ") + "." : ""}`, fx: "hit" };
  }

  // ---------------------------------------------------------------- the workbench
  function make(s, pid, part, times = 1) {
    const h = plot(s, pid), b = BENCH[part]; if (!h || !b) return { err: "Nothing to make." };
    if (s.location !== PLOTS[pid].town) return { err: "The workbench is at your plot." };
    times = Math.max(1, Math.min(20, times | 0));
    const lack = [...Object.entries(b[1]).filter(([i, n]) => count(s, i) < n * times).map(([i, n]) => `${n * times - count(s, i)} more ${itemName(i)}`),
      ...Object.entries(b[2]).filter(([k, n]) => (h.stock[k] || 0) < n * times).map(([k, n]) => `${n * times - (h.stock[k] || 0)} more ${MATS[k][0].toLowerCase()}`)];
    if (lack.length) return { err: `You need ${lack.join(" and ")}.` };
    for (const [i, n] of Object.entries(b[1])) consume(s, i, n * times);
    for (const [k, n] of Object.entries(b[2])) h.stock[k] -= n * times;
    h.stock[part] = (h.stock[part] || 0) + b[0] * times;
    const ups = G.useSkill(s, "Smithing", 6 * times);
    return { text: `At the workbench: +${b[0] * times} ${MATS[part][0].toLowerCase()}.${ups.length ? " " + ups.join(". ") + "." : ""}`, fx: "clang" };
  }

  // ---------------------------------------------------------------- building
  function canBuild(s, pid, what) {
    const h = plot(s, pid); if (!h) return "You don't own this land.";
    if (what === "small") return h.small ? "The small house is already standing." : null;
    if (what === "hall") return h.hall ? "The main hall is built." : !h.small ? "Build the small house first." : null;
    if (!WINGS[what]) return "You can't build that.";
    if (!h.hall) return "Wings go onto the main hall. Build it first.";
    if (wingsOf(h).includes(what)) return `The ${WINGS[what][0].toLowerCase()} is already built.`;
    if (wingsOf(h).length >= WING_SLOTS) return "All three wing spaces are used.";
    return null;
  }
  const costOf = (s, what) => need(s, (STAGES[what] || WINGS[what])[2]);
  function build(s, pid, what, t = now()) {
    const e = canBuild(s, pid, what); if (e) return { err: e };
    if (s.location !== PLOTS[pid].town) return { err: `You build at ${PLOTS[pid].name}, near ${PLOTS[pid].town}.` };
    const h = plot(s, pid), mats = costOf(s, what), lack = missing(h, mats);
    if (lack.length) return { err: `You still need ${lack.join(", ")}.` };
    for (const [k, n] of Object.entries(mats)) h.stock[k] -= n;
    const nm = (STAGES[what] || WINGS[what])[0];
    if (STAGES[what]) h[what] = t; else { h.wings = [...wingsOf(h), what]; h.col[what] = t; }
    const ups = G.useSkill(s, "Smithing", 40);
    G.note(s, `🏡 Built the ${nm.toLowerCase()} at ${PLOTS[pid].name}.`);
    return { title: `${PLOTS[pid].name}: ${nm}`, text: `The ${nm.toLowerCase()} stands. ${(STAGES[what] || WINGS[what])[1]}${ups.length ? " " + ups.join(". ") + "." : ""}` };
  }

  // ---------------------------------------------------------------- living there
  function sleep(s, pid, t = now()) {
    const h = plot(s, pid); if (!h?.small) return { err: "Build the small house first: then there's a bed." };
    if (s.location !== PLOTS[pid].town) return { err: "Your bed is at your homestead." };
    G.setHealth(s, G.maxHealth(s), t); if (typeof WFX !== "undefined") WFX.warmUp(s, 100, t);
    s.rested = t + RESTED; s.restBonus = 0.1;   // [Skyrim] your own bed: Well Rested +10%
    return { text: "You sleep in your own bed. Fully healed and Well Rested: skills improve 10% faster for 40 minutes.", fx: "click" };
  }
  /* what one wing makes in one day: { items: [[id, n]], gold, study } */
  function produce(s, w) {
    const r = { items: [], gold: 0, lines: [] };
    const add = (id, n) => { if (D.ITEMS[id]) r.items.push([id, n]); };
    if (w === "armory") add(D.ITEMS.arrow_steel ? "arrow_steel" : "arrow_iron", 12);
    else if (w === "greenhouse") { const pool = GREEN.filter((i) => D.ITEMS[i]), k = G.P(s, "green_thumb") ? 2 : 1; for (let i = 0; i < 6; i++) add(pick(pool), k); }
    else if (w === "kitchen") { const pool = MEALS.filter((i) => D.ITEMS[i]); for (let i = 0; i < 2; i++) add(pool.length ? pick(pool) : "potion_stamina", 1); }
    else if (w === "trophy") r.gold += Math.min(150, 20 + 10 * (s.dragons || 0));
    else if (w === "enchanter") add("soul_gem_common", 1);
    else if (w === "alchemy") for (let i = 0; i < 2; i++) add(pick(POTIONS), 1);
    else if (w === "library") {
      const sks = Object.keys(s.skills).filter((k) => s.skills[k].lvl < 100);
      if (sks.length) { const sk = sks.sort((a, b) => s.skills[b].lvl - s.skills[a].lvl)[Math.floor(Math.random() * Math.min(5, sks.length))]; const ups = G.useSkill(s, sk, 60); r.lines.push(`you study ${sk}${ups.length ? ` (${ups.join(", ")})` : ""}`); }
    }
    r.gold += fx(s, "hsrent");   // Estate Income
    return r;
  }
  /* days of goods waiting in each wing (capped by what the house can keep) */
  function ready(s, pid, t = now()) {
    const h = plot(s, pid); if (!h) return {};
    const cap = keepDays(s, pid), out = {};
    for (const w of wingsOf(h)) if (w !== "storage" || fx(s, "hsrent")) out[w] = Math.min(cap, Math.floor((t - (h.col[w] || t)) / DAY));
    return out;
  }
  function collect(s, pid, t = now()) {
    const h = plot(s, pid); if (!h) return { err: "You don't own this land." };
    if (s.location !== PLOTS[pid].town) return { err: "Collect at the homestead." };
    const rd = ready(s, pid, t), got = {}, lines = []; let gold = 0, any = false;
    for (const [w, days] of Object.entries(rd)) {
      if (days <= 0) continue; any = true;
      const raw = Math.floor((t - h.col[w]) / DAY);
      h.col[w] = raw > days ? t - ((t - h.col[w]) % DAY) : h.col[w] + days * DAY;   // goods past the cap are lost
      for (let d = 0; d < days; d++) { const r = produce(s, w); gold += r.gold; lines.push(...r.lines); for (const [id, n] of r.items) got[id] = (got[id] || 0) + n; }
    }
    if (!any) return { err: "Nothing is ready yet. The wings make something once an in-game day." };
    for (const [id, n] of Object.entries(got)) G.give(s, id, n);
    s.gold += gold;
    const parts = [...Object.entries(got).map(([id, n]) => `${itemName(id)} ×${n}`), ...(gold ? [`${gold} gold`] : []), ...lines];
    return { text: `From ${PLOTS[pid].name}: ${parts.join(", ") || "nothing"}.`, fx: "coin" };
  }
  // the storage room: safe from death, like your house chest
  function stash(s, pid, rowId) {
    const h = plot(s, pid); if (!wingsOf(h).includes("storage")) return { err: "Build a storage room first." };
    const r = G.invRow(s, rowId); if (!r) return { err: "You don't have that." };
    if (Object.values(G.equipment(s) || {}).some((x) => x && x.id === r.id)) return { err: "Take it off first." };
    if (h.store.length >= STORE_CAP) return { err: `The storage room is full (${STORE_CAP}).` };
    const copy = { ...r }; delete copy.id; G.take(s, rowId, r.qty); h.store.push(copy);
    return { text: `${itemName(copy.item)}${copy.qty > 1 ? ` ×${copy.qty}` : ""} goes in the storage room.`, fx: "click" };
  }
  function unstash(s, pid, idx) {
    const h = plot(s, pid), r = h?.store?.[idx]; if (!r) return { err: "It's not there." };
    h.store.splice(idx, 1);
    const id = G.give(s, r.item, r.qty, r.charge), row = G.invRow(s, id);
    if (row && (r.temper || r.stolen)) Object.assign(row, { temper: r.temper, tq: r.tq, stolen: r.stolen });
    return { text: `You take ${itemName(r.item)}${r.qty > 1 ? ` ×${r.qty}` : ""}.`, fx: "click" };
  }

  // ---------------------------------------------------------------- the steward
  function hire(s, pid, t = now()) {
    const h = plot(s, pid); if (!h) return { err: "You don't own this land." };
    if (h.steward) return { err: "You already have a steward here." };
    if (!h.small) return { err: "A steward needs somewhere to sleep. Build the small house first." };
    const fee = stewardFee(s); if (s.gold < fee) return { err: `${PLOTS[pid].steward[0]} wants ${fee} gold to start.` };
    s.gold -= fee; h.steward = true;
    return { title: "A steward", text: `${PLOTS[pid].steward[0]} takes ${fee} gold and moves into ${PLOTS[pid].name}. At home they keep the wings' goods for up to 3 days and sell you building materials. Take them along and they fight beside you.` };
  }
  function follow(s, pid, t = now()) {
    const h = plot(s, pid); if (!h?.steward) return { err: "Hire a steward first." };
    const id = stewardId(pid), nm = PLOTS[pid].steward[0];
    if (s.follower?.id === id) { s.follower = null; return { text: `${nm} goes back to mind ${PLOTS[pid].name}.`, fx: "click" }; }
    if (s.follower) return { err: `${TOWNS.FOLLOWERS[s.follower.id]?.[0] || "Someone"} is already with you. Dismiss them first.` };
    s.follower = { id, hp: TOWNS.followerMax(s, id), ts: t };
    return { text: `${nm} grabs a weapon and follows you. The wings keep only a day of goods while they're away.`, fx: "click" };
  }
  // the steward sells deliveries: what → [plot stock, how many, gold]
  const DELIVER = { log: ["log", 10, 200], stone: ["stone", 10, 150], clay: ["clay", 10, 100], quartz: ["quartz", 4, 120] };
  function order(s, pid, k) {
    const d = DELIVER[k], h = plot(s, pid); if (!d || !h) return { err: "Nothing to order." };
    if (!stewardHome(s, pid)) return { err: h.steward ? "Your steward is out with you. Send them home to order." : "Hire a steward first." };
    if (s.gold < d[2]) return { err: `${d[1]} ${MATS[d[0]][0].toLowerCase()} cost ${d[2]} gold.` };
    s.gold -= d[2]; h.stock[d[0]] = (h.stock[d[0]] || 0) + d[1];
    return { text: `Your steward has ${d[1]} ${MATS[d[0]][0].toLowerCase()} delivered for ${d[2]} gold.`, fx: "coin" };
  }

  // ---------------------------------------------------------------- pictures (art.js toolkit; pixel style applies too)
  const W = 360, HT = 190;
  const LOOKS = {
    lake: { ground: "#8c9a5a", ground2: "#6f7f44", sky: "day", water: "#5f8797", trees: "pine" },
    marsh: { ground: "#6f7a4a", ground2: "#55603a", sky: "dusk", water: "#4a6058", trees: "dead", fog: true },
    coast: { ground: "#e8edf0", ground2: "#c9d3da", sky: "snow", water: "#30505e", trees: "pine", snow: true },
  };
  function roofed(g, H, x, base, w, h, wall, roof, logs = true) {
    H.poly(g, [[x, base], [x, base - h], [x + w, base - h], [x + w, base]], wall, "#3b2c1e", 1.3);
    if (logs) { g.strokeStyle = "rgba(59,44,30,.45)"; g.lineWidth = 1; for (let y = base - h + 5; y < base; y += 5) { g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + w - 1, y); g.stroke(); } }
    H.poly(g, [[x - 5, base - h + 1], [x + w / 2, base - h - w * 0.36], [x + w + 5, base - h + 1]], roof, "#3b2c1e", 1.3);
  }
  function win(g, x, y, w, h, lit, color = "#f6d27a") { g.fillStyle = lit ? color : "#2a3340"; g.fillRect(x, y, w, h); g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.2; g.strokeRect(x, y, w, h); g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke(); }
  function smoke(g, x, y) { g.strokeStyle = "rgba(235,235,235,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 14, x - 2, y - 28); g.quadraticCurveTo(x - 10, y - 40, x + 4, y - 52); g.stroke(); }
  function tower(g, H, x, base, w, h, wall, glow) {
    H.poly(g, [[x, base], [x + 2, base - h], [x + w - 2, base - h], [x + w, base]], wall, "#3b2c1e", 1.3);
    g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1; for (let y = base - h + 8; y < base; y += 9) { g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + w - 2, y); g.stroke(); }
    H.poly(g, [[x - 4, base - h + 2], [x + w / 2, base - h - w * 0.9], [x + w + 4, base - h + 2]], "#4f3826", "#3b2c1e", 1.3);
    const gy = base - h * 0.7; const gl = g.createRadialGradient(x + w / 2, gy, 1, x + w / 2, gy, 18); gl.addColorStop(0, glow); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(x - 14, gy - 18, w + 28, 36);
    win(g, x + w / 2 - 4, gy - 6, 8, 12, true, glow);
  }
  /* one wing at (x, base) with width w: also used for the small pictures in the build list */
  function wingArt(g, H, kind, x, base, w, night) {
    const h = 34;
    if (kind === "enchanter") return tower(g, H, x + w * 0.2, base, w * 0.6, 62, "#8f8aa0", "rgba(201,182,255,.95)");
    if (kind === "alchemy") return tower(g, H, x + w * 0.2, base, w * 0.6, 58, "#8a8a72", "rgba(140,220,120,.95)");
    if (kind === "greenhouse") {
      H.poly(g, [[x, base], [x, base - h + 6], [x + w, base - h + 6], [x + w, base]], "rgba(190,225,235,.55)", "#3b2c1e", 1.3);
      H.poly(g, [[x - 3, base - h + 7], [x + w / 2, base - h - 12], [x + w + 3, base - h + 7]], "rgba(190,225,235,.6)", "#3b2c1e", 1.3);
      g.strokeStyle = "#6f4f33"; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (w * i) / 4, base); g.lineTo(x + (w * i) / 4, base - h + 6); g.stroke(); }
      for (let i = 0; i < 5; i++) H.circle(g, x + 5 + i * (w - 10) / 4, base - 6, 4, i % 2 ? "#557a47" : "#3d5d36", null);
      return;
    }
    const wall = { armory: "#8f8a80", library: "#7a5232", kitchen: "#8a6440", trophy: "#6f4f33", storage: "#8a6a48" }[kind] || "#7a5232";
    roofed(g, H, x, base, w, h, wall, kind === "armory" ? "#5f5a54" : "#5a4330", kind !== "armory");
    const cx = x + w / 2, my = base - h / 2 - 2;
    if (kind === "armory") { H.circle(g, cx, my, 7, "#8e2b25", "#d6b25e", 1.4); g.strokeStyle = "#d6b25e"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 5, my); g.lineTo(cx + 5, my); g.moveTo(cx, my - 5); g.lineTo(cx, my + 5); g.stroke();
      g.strokeStyle = "#a9b0b4"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, base - 4); g.lineTo(x + 14, base - h + 4); g.moveTo(x + 14, base - 4); g.lineTo(x + 4, base - h + 4); g.stroke(); }
    if (kind === "library") { for (const dx of [-0.3, 0.3]) { g.fillStyle = night ? "#f6d27a" : "#e9c070"; g.beginPath(); g.moveTo(cx + dx * w - 4, base - 6); g.lineTo(cx + dx * w - 4, base - h + 10); g.arc(cx + dx * w, base - h + 10, 4, Math.PI, 0); g.lineTo(cx + dx * w + 4, base - 6); g.fill(); g.strokeStyle = "#3b2c1e"; g.lineWidth = 1; g.stroke(); }
      for (let i = 0; i < 4; i++) { g.fillStyle = ["#8e2b25", "#30505e", "#3d5d36", "#d6b25e"][i]; g.fillRect(cx - 6 + i * 3, base - 12, 3, 10); } }
    if (kind === "kitchen") { g.fillStyle = "#6f6a64"; g.fillRect(x + w * 0.7, base - h - 14, 7, 16); smoke(g, x + w * 0.7 + 3, base - h - 16); H.circle(g, x + 8, base - 5, 5, "#7a5232", "#3b2c1e", 1); win(g, cx - 5, my - 4, 10, 9, true); }
    if (kind === "trophy") { g.strokeStyle = "#e9dcc0"; g.lineWidth = 2; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx, my); g.quadraticCurveTo(cx + d * 9, my - 6, cx + d * 12, my - 14); g.stroke(); } H.circle(g, cx, my + 2, 4, "#8a6a3e", "#3b2c1e", 1);
      H.poly(g, [[x + 3, base - 3], [x + 9, base - 9], [x + 17, base - 7], [x + 19, base - 2]], "#e9dcc0", "#3b2c1e", 1); }
    if (kind === "storage") { for (const [bx, c] of [[x + 3, "#6f4f33"], [x + w - 15, "#5a4330"]]) { H.poly(g, [[bx, base], [bx + 12, base], [bx + 12, base - 11], [bx, base - 11]], c, "#3b2c1e", 1); } H.circle(g, cx, base - 7, 6, "#7a5232", "#3b2c1e", 1); g.fillStyle = "#3b2c1e"; g.fillRect(cx - 6, base - 9, 12, 1.5); }
  }
  function smallHouse(g, H, x, base, night) { roofed(g, H, x, base, 64, 34, "#7a5232", "#5a4330"); g.fillStyle = "#3b2c1e"; g.fillRect(x + 26, base - 20, 12, 20); win(g, x + 8, base - 24, 10, 9, night); win(g, x + 46, base - 24, 10, 9, night); g.fillStyle = "#6f6a64"; g.fillRect(x + 48, base - 50, 7, 14); smoke(g, x + 51, base - 52); }
  function mainHall(g, H, x, base, w, night) {
    roofed(g, H, x, base, w, 44, "#7a5232", "#4f3826");
    // crossed gable beams like a Nord longhouse
    const top = base - 44 - w * 0.36; g.strokeStyle = "#3b2c1e"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + w / 2 - 10, top - 8); g.lineTo(x + w / 2 + 6, top + 8); g.moveTo(x + w / 2 + 10, top - 8); g.lineTo(x + w / 2 - 6, top + 8); g.stroke();
    g.fillStyle = "#3b2c1e"; g.fillRect(x + w / 2 - 9, base - 26, 18, 26); g.fillStyle = "#d6b25e"; g.fillRect(x + w / 2 + 4, base - 14, 2, 2);
    for (const wx of [x + 12, x + 32, x + w - 42, x + w - 22]) win(g, wx, base - 30, 10, 10, night);
    g.fillStyle = "#6f6a64"; g.fillRect(x + w * 0.22, base - 44 - w * 0.2, 9, 18); smoke(g, x + w * 0.22 + 4, base - 46 - w * 0.2);
  }
  function person(g, H, x, y) { H.circle(g, x, y - 26, 4.5, "#d9b48c", "#3b2c1e", 1); H.poly(g, [[x - 6, y - 21], [x + 6, y - 21], [x + 8, y], [x - 8, y]], "#30505e", "#3b2c1e", 1); H.poly(g, [[x - 12, y - 16], [x - 6, y - 18], [x - 6, y - 10], [x - 12, y - 8]], "#e9dcc0", "#3b2c1e", 0.8); }
  function pile(g, H, x, base, n, kind) {   // stock piles by the sawmill and quarry
    const k = Math.min(6, Math.ceil(n / 6));
    for (let i = 0; i < k; i++) {
      if (kind === "log") { g.fillStyle = "#8a6440"; g.fillRect(x + (i % 3) * 3, base - 4 - Math.floor(i / 3) * 5 - i * 0, 22, 4); H.circle(g, x + 22 + (i % 3) * 3, base - 2 - Math.floor(i / 3) * 5, 2.5, "#c9a77a", "#3b2c1e", 0.8); }
      else H.circle(g, x + (i % 3) * 7, base - 3 - Math.floor(i / 3) * 6, 3.5, "#9a9086", "#3b2c1e", 0.8);
    }
  }
  function scene(pid, h, opts = {}) {
    const p = PLOTS[pid], L = LOOKS[p.look], night = typeof G !== "undefined" && G.isNight(now());
    const wings = wingsOf(h), st = h ? stage(h) : 0, sh = h && h.steward && !opts.away;
    const key = `hstead|${pid}|${st}|${wings.join(",")}|${sh ? 1 : 0}|${Math.min(6, Math.ceil((h?.stock?.log || 0) / 6))}|${Math.min(6, Math.ceil((h?.stock?.stone || 0) / 6))}|${night ? "n" : "d"}|${opts.thumb || ""}`;
    const draw = (g, H) => {
      H.sky(g, W, HT * 0.62, night ? "night" : L.sky);
      if (night) { g.fillStyle = "#f4f6f8"; const r = H.seeded(pid); for (let i = 0; i < 30; i++) g.fillRect(r() * W, r() * HT * 0.4, 1.2, 1.2); }
      H.mountains(g, W, HT * 0.58, HT * 0.3, pid.length * 7, p.look === "marsh" ? "#6f6a5a" : "#8f7a66", p.look !== "marsh");
      g.fillStyle = L.water; if (p.look === "lake") g.fillRect(0, HT * 0.56, W * 0.42, HT * 0.08); else if (p.look === "coast") g.fillRect(W * 0.55, HT * 0.55, W * 0.45, HT * 0.09);
      const gr = g.createLinearGradient(0, HT * 0.6, 0, HT); gr.addColorStop(0, L.ground); gr.addColorStop(1, L.ground2); g.fillStyle = gr; g.fillRect(0, HT * 0.6, W, HT * 0.4);
      if (p.look === "marsh") { g.fillStyle = L.water; for (const [x, y, w] of [[20, 0.78, 50], [290, 0.9, 60]]) { g.beginPath(); g.ellipse(x + w / 2, HT * y, w / 2, 5, 0, 0, 7); g.fill(); }
        g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.6; for (const tx of [70, 300, 330]) { g.beginPath(); g.moveTo(tx, HT * 0.66); g.lineTo(tx, HT * 0.42); g.moveTo(tx, HT * 0.5); g.lineTo(tx - 9, HT * 0.44); g.moveTo(tx, HT * 0.55); g.lineTo(tx + 8, HT * 0.5); g.stroke(); } }
      else H.pines(g, W, HT * 0.63, 14, pid.length * 3, 13);
      // the sawmill (left) and the quarry (right) are always there
      const base = HT * 0.9, back = HT * 0.74;   // the sawmill and quarry stand further back, the house in front
      g.fillStyle = "#6f4f33"; g.fillRect(8, back - 26, 3, 26); g.fillRect(40, back - 26, 3, 26); g.fillRect(6, back - 28, 40, 4); H.circle(g, 25, back - 16, 9, "#a9b0b4", "#3b2c1e", 1.2); g.fillStyle = "#3b2c1e"; g.fillRect(24, back - 17, 2, 2);
      pile(g, H, 48, back + 2, h?.stock?.log || 0, "log");
      H.poly(g, [[W - 52, back], [W - 44, back - 30], [W - 20, back - 36], [W - 4, back - 20], [W - 2, back]], "#8f8a80", "#3b2c1e", 1.2);
      pile(g, H, W - 72, back + 2, h?.stock?.stone || 0, "stone");
      g.fillStyle = "#8a5a34"; g.beginPath(); g.ellipse(W - 30, base + 6, 14, 4, 0, 0, 7); g.fill();
      const cx = W / 2 + 22;
      if (st === 0) {   // stakes and string: the house to be
        g.strokeStyle = "#e9dcc0"; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(cx - 60, base - 20, 120, 20); g.setLineDash([]);
        for (const [sx, sy] of [[cx - 60, base - 20], [cx + 60, base - 20], [cx - 60, base], [cx + 60, base]]) { g.fillStyle = "#6f4f33"; g.fillRect(sx - 1.5, sy - 8, 3, 10); }
        g.fillStyle = "#6f4f33"; g.fillRect(cx - 1.5, base - 40, 3, 30); g.fillStyle = "#cdb98f"; g.fillRect(cx - 16, base - 46, 32, 12); g.strokeStyle = "#3b2c1e"; g.strokeRect(cx - 16, base - 46, 32, 12);
      } else {
        // a row: [wing 2][wing 1][main hall][wing 3]
        if (st >= 2) mainHall(g, H, cx - 50, base, 100, night); else smallHouse(g, H, cx - 32, base, night);
        if (st >= 2) { g.fillStyle = "#6f4f33"; g.fillRect(cx - 16, base - 6, 32, 6); }   // the old small house is now the porch
        if (wings[0]) wingArt(g, H, wings[0], cx - 102, base, 48, night);
        if (wings[1]) wingArt(g, H, wings[1], cx - 154, base, 48, night);
        if (wings[2]) wingArt(g, H, wings[2], cx + 56, base, 48, night);
      }
      if (sh) person(g, H, cx + (st >= 2 ? 22 : 40), base + 2);
      if (L.fog) { g.fillStyle = "rgba(220,225,215,.22)"; g.fillRect(0, HT * 0.62, W, 16); g.fillRect(0, HT * 0.8, W, 10); }
      if (L.snow) { g.fillStyle = "#f4f6f8"; const r = H.seeded(pid + "s"); for (let i = 0; i < 40; i++) g.fillRect(r() * W, r() * HT, 1.6, 1.6); }
      if (night) { g.fillStyle = "rgba(20,26,45,.3)"; g.fillRect(0, 0, W, HT); }
      if (ART.drawingStyle() !== "pixel") { g.fillStyle = "rgba(43,32,22,.85)"; g.fillRect(W / 2 - 85, 7, 170, 18); g.fillStyle = "#e9d7a8"; g.font = "bold 12px Georgia, serif"; g.textAlign = "center"; g.fillText(p.name, W / 2, 20); g.textAlign = "left"; }
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, HT - 3);
    };
    return ART.html(W, HT, draw, { key, cls: "scene hsart", alt: `${p.name}: ${["bare land", "small house", "main hall"][st]}${wings.length ? " with " + wings.map((w) => WINGS[w][0]).join(", ") : ""}` });
  }
  /* a small picture of one stage or wing, for the build list */
  function thumb(what) {
    const night = false;
    return ART.html(64, 46, (g, H) => {
      H.sky(g, 64, 46, "day"); g.fillStyle = "#8c9a5a"; g.fillRect(0, 36, 64, 10);
      g.save(); g.translate(32, 0);
      if (what === "small") { g.scale(0.62, 0.62); smallHouse(g, H, -32, 64, night); }
      else if (what === "hall") { g.scale(0.4, 0.4); mainHall(g, H, -58, 100, 116, night); }
      else { g.scale(0.7, 0.7); wingArt(g, H, what, -25, 56, 50, night); }
      g.restore(); g.strokeStyle = "#3b2c1e"; g.lineWidth = 2; g.strokeRect(1, 1, 62, 44);
    }, { key: "hsthumb|" + what, cls: "hsthumb", alt: (STAGES[what] || WINGS[what])[0] });
  }

  // ---------------------------------------------------------------- the screen (a town section)
  let view = "build";
  const VIEWS = [["build", "Build"], ["gather", "Gather"], ["bench", "Workbench"], ["home", "Home"], ["steward", "Steward"]];
  const sections = (town) => (BY_TOWN[town] ? ["homestead"] : []);
  const names = (s, town) => (BY_TOWN[town] ? { homestead: `🏡 ${PLOTS[BY_TOWN[town]].name}` } : {});
  const btn = (act, c, label, ok = true, cls = "") => `<button class="btn sm ${cls}" data-act="hsact" data-id="${act}" data-c="${c}" ${ok ? "" : "disabled"}>${label}</button>`;
  function matRow(h, mats, esc) {
    return `<div class="hsmats">${Object.entries(mats).map(([k, n]) => { const have = h.stock[k] || 0; return `<span class="hsm ${have >= n ? "ok" : "no"}" title="${esc(MATS[k][0])}">${MATS[k][1]} ${have}/${n}</span>`; }).join("")}</div>`;
  }
  function stockHTML(h, esc) {
    return `<div class="hsstock">${Object.keys(MATS).map((k) => `<span class="hsm" title="${esc(MATS[k][0])}">${MATS[k][1]} <b>${h.stock[k] || 0}</b> <small>${esc(MATS[k][0])}</small></span>`).join("")}</div>`;
  }
  function townHTML(s, esc) {
    const pid = here(s); if (!pid) return { note: "", body: "" };
    const p = PLOTS[pid], h = plot(s, pid), t = now();
    if (!h) {
      const price = deedPrice(s), ownList = owned(s).map((k) => PLOTS[k].name);
      return { note: `The Jarl's steward in ${p.town} sells the deed to land nearby. Build your own house on it, stage by stage.`,
        body: `<div class="hs">${scene(pid, null)}<div class="card hscard"><h3>${esc(p.name)}</h3><p class="sub">${esc(p.desc)}</p>
          <p class="sub">Build a small house, then a main hall, then three wings of your choice. You gather the logs, stone and clay here and make the nails, hinges and locks yourself.</p>
          <button class="btn pri" style="width:100%" data-act="hsact" data-id="deed" data-c="${pid}" ${s.gold >= price && !wanted(s) ? "" : "disabled"}>Buy the deed · ${price.toLocaleString()} gold</button>
          ${s.gold < price ? `<p class="sub">You have ${s.gold.toLocaleString()} gold.</p>` : ""}${ownList.length ? `<p class="sub">You own: ${ownList.map(esc).join(", ")}.</p>` : ""}</div>
          <p class="sub hsother">Other plots: ${Object.entries(PLOTS).filter(([k]) => k !== pid).map(([, o]) => `${esc(o.name)} (${esc(o.town)})`).join(" · ")}</p></div>` };
    }
    const tabs = `<div class="chips hstabs">${VIEWS.map(([k, l]) => `<button class="chip ${view === k ? "on" : ""}" data-act="hsact" data-id="view" data-c="${k}">${l}</button>`).join("")}</div>`;
    const st = stage(h), wings = wingsOf(h);
    let b = "";
    if (view === "build") {
      const row = (id, def, ok, why) => { const mats = costOf(s, id), lack = missing(h, mats);
        return `<div class="item hsrow ${ok ? "" : "locked"}">${thumb(id)}<div class="t">${esc(def[0])}<span>${esc(def[1])}</span>${ok ? matRow(h, mats, esc) : `<span class="hswhy">${esc(why)}</span>`}</div>${ok ? btn("build", id, "Build", !lack.length, "pri") : ""}</div>`; };
      const done = (id, def) => `<div class="item hsrow on">${thumb(id)}<div class="t">✔ ${esc(def[0])}<span>${esc(def[1])}</span></div></div>`;
      b += `<h3 class="hsh">House</h3>` + ["small", "hall"].map((id) => (h[id] ? done(id, STAGES[id]) : row(id, STAGES[id], !canBuild(s, pid, id), canBuild(s, pid, id)))).join("");
      b += `<h3 class="hsh">Wings · ${wings.length}/${WING_SLOTS}</h3><p class="sub" style="margin-top:0">${h.hall ? "Three spaces. A wing can't be torn down, so pick the ones you'll use." : "Wings go onto the main hall."}</p>`
        + wings.map((w) => done(w, WINGS[w])).join("")
        + (wings.length < WING_SLOTS ? Object.keys(WINGS).filter((w) => !wings.includes(w)).map((w) => row(w, WINGS[w], !!h.hall, "Needs the main hall.")).join("") : "");
      b += `<h3 class="hsh">At the plot</h3>` + stockHTML(h, esc);
    } else if (view === "gather") {
      b += Object.entries(GATHER).map(([k, g]) => { const left = cdLeft(h, k, t), tool = g[3] && !count(s, g[3]);
        return `<div class="item"><div class="t">${MATS[g[1]][1]} ${esc(g[0])}<span>${g[2][0]}–${g[2][1]} ${esc(MATS[g[1]][0].toLowerCase())}${k === "quarry" ? ", sometimes quartz · needs a pickaxe" : ""}${fx(s, "hsyield") ? " · Woodsman +50%" : ""}</span>${left ? `<span class="hswhy">Again in ${Math.ceil(left / 60)} min</span>` : tool ? `<span class="hswhy">You have no pickaxe</span>` : ""}</div>${btn("gather", k, "Work", !left && !tool, "pri")}</div>`; }).join("");
      b += `<h3 class="hsh">Deliveries</h3><p class="sub" style="margin-top:0">${stewardHome(s, pid) ? "Your steward can have materials brought in." : "Hire a steward (and leave them at home) to order materials."}</p>`
        + Object.entries(DELIVER).map(([k, d]) => `<div class="item"><div class="t">${MATS[d[0]][1]} ${d[1]} ${esc(MATS[d[0]][0].toLowerCase())}</div><span class="num gold">${d[2]}</span>${btn("order", k, "Order", stewardHome(s, pid) && s.gold >= d[2])}</div>`).join("");
      b += `<h3 class="hsh">At the plot</h3>` + stockHTML(h, esc);
    } else if (view === "bench") {
      b += `<p class="sub" style="margin-top:0">Hammer your own Iron Ingots into parts. Glass is melted from quartz over a Firewood fire. You have ${count(s, "mat_iron")} Iron Ingots and ${count(s, "mat_firewood")} Firewood.</p>`
        + Object.entries(BENCH).map(([k, [n, inv, st2]]) => { const uses = [...Object.entries(inv).map(([i, m]) => `${m} ${itemName(i)}`), ...Object.entries(st2).map(([q, m]) => `${m} ${MATS[q][0].toLowerCase()}`)].join(" + ");
          const can = (x) => Object.entries(inv).every(([i, m]) => count(s, i) >= m * x) && Object.entries(st2).every(([q, m]) => (h.stock[q] || 0) >= m * x);
          return `<div class="item"><div class="t">${MATS[k][1]} ${esc(MATS[k][0])} ×${n}<span>${esc(uses)} · you have ${h.stock[k] || 0}</span></div><div class="hsbtns">${btn("make", k + ":1", "Make", can(1), "pri")}${btn("make", k + ":5", "×5", can(5))}</div></div>`; }).join("");
    } else if (view === "home") {
      if (!h.small) b += `<p class="sub">Nothing to live in yet. Build the small house first.</p>`;
      else {
        b += `<div class="item"><div class="t">🛏 Your bed<span>Full health and Well Rested (+10% skills for 40 minutes)</span></div>${btn("sleep", pid, "Sleep", true, "pri")}</div>`;
        const rd = ready(s, pid, t), made = wings.filter((w) => w !== "storage" || fx(s, "hsrent"));
        if (made.length) {
          b += `<h3 class="hsh">From the wings</h3><p class="sub" style="margin-top:0">Goods pile up for ${keepDays(s, pid)} in-game day${keepDays(s, pid) > 1 ? "s" : ""}${stewardHome(s, pid) ? " (your steward keeps them)" : ""}.</p>`
            + made.map((w) => { const nxt = (h.col[w] || t) + DAY - t; return `<div class="item"><div class="t">${esc(WINGS[w][0])}<span>${rd[w] > 0 ? `<b class="hsready">${rd[w]} day${rd[w] > 1 ? "s" : ""} ready</b>` : `Next in ${Math.max(1, Math.ceil(nxt / 60))} min`}</span></div></div>`; }).join("")
            + `<button class="btn pri" style="width:100%;margin-top:8px" data-act="hsact" data-id="collect" data-c="${pid}" ${Object.values(rd).some((d) => d > 0) ? "" : "disabled"}>Collect everything</button>`;
        }
        if (wings.includes("storage")) {
          const pack = s.inv.filter((r) => !Object.values(G.equipment(s) || {}).some((x) => x && x.id === r.id));
          b += `<h3 class="hsh" id="hsstore">Storage room · ${h.store.length}/${STORE_CAP}</h3>`
            + (h.store.length ? h.store.map((r, i) => `<div class="item">${typeof ICONART !== "undefined" ? ICONART.item(r.item, 30, r) : ""}<div class="t">${esc(itemName(r.item))}${r.qty > 1 ? ` ×${r.qty}` : ""}</div>${btn("unstash", i, "Take")}</div>`).join("") : `<p class="sub">Empty. Anything here is safe even if you die.</p>`)
            + `<details><summary class="sub" style="cursor:pointer;min-height:36px">Put something in</summary>${pack.slice(0, 40).map((r) => `<div class="item"><div class="t">${esc(itemName(r.item))}${r.qty > 1 ? ` ×${r.qty}` : ""}</div>${btn("stash", r.id, "Store", h.store.length < STORE_CAP)}</div>`).join("") || `<p class="sub">Your pack is empty.</p>`}</details>`;
        }
      }
    } else if (view === "steward") {
      const [nm, hp, dmg, desc] = p.steward, id = stewardId(pid), port = typeof NPCART !== "undefined" ? NPCART.follower(id, 44) : "";
      b += `<div class="item hsrow">${port}<div class="t">${esc(nm)}<span>${esc(desc)}</span><span>Health ${hp} · hits for ${dmg}</span></div></div>`;
      if (!h.steward) b += `<p class="sub">At home a steward keeps the wings' goods for 3 days instead of 1 and orders building materials. Or take them along: they fight beside you (and get knocked down, never killed).</p>${btn("hire", pid, `Hire · ${stewardFee(s)} gold`, !!h.small && s.gold >= stewardFee(s), "pri")}${h.small ? "" : `<p class="sub">Build the small house first.</p>`}`;
      else b += `<p class="sub">${s.follower?.id === id ? `${esc(nm)} is travelling with you.` : `${esc(nm)} is at home, minding ${esc(p.name)}.`}</p>${btn("follow", pid, s.follower?.id === id ? "Send home" : "Take along", s.follower?.id === id || !s.follower, "pri")}${s.follower && s.follower.id !== id ? `<p class="sub">${esc(TOWNS.FOLLOWERS[s.follower.id]?.[0] || "Someone")} is with you now.</p>` : ""}`;
    }
    const line = ["Bare land", "Small house", "Main hall"][st] + (wings.length ? ` · ${wings.map((w) => WINGS[w][0]).join(", ")}` : "");
    return { note: `${p.name}, your homestead near ${p.town}. ${line}.`, body: `<div class="hs">${scene(pid, h, { away: !stewardHome(s, pid) })}${tabs}<div class="hsbody">${b}</div></div>` };
  }
  /* every button on the screen: data-act="hsact" data-id=what data-c=arg */
  function act(s, what, c, t = now()) {
    const pid = here(s);
    if (what === "view") { if (VIEWS.some(([k]) => k === c)) view = c; return {}; }
    if (what === "deed") return buyDeed(s, t);
    if (!pid || !plot(s, pid)) return { err: "You don't own land here." };
    switch (what) {
      case "gather": return gather(s, pid, c, t);
      case "make": { const [part, n] = String(c).split(":"); return make(s, pid, part, +n || 1); }
      case "build": return build(s, pid, c, t);
      case "sleep": return sleep(s, pid, t);
      case "collect": return collect(s, pid, t);
      case "stash": return stash(s, pid, +c);
      case "unstash": return unstash(s, pid, +c);
      case "hire": return hire(s, pid, t);
      case "follow": return follow(s, pid, t);
      case "order": return order(s, pid, c);
    }
    return { err: "Nothing happens." };
  }

  return { DAY, PLOTS, BY_TOWN, MATS, BENCH, STAGES, WINGS, GATHER, DELIVER, WING_SLOTS, STORE_CAP, GATHER_CD, stewardId, plot, owned, stage, deedPrice, stewardFee, costOf, keepDays, stewardHome,
    buyDeed, gather, make, canBuild, build, sleep, produce, ready, collect, stash, unstash, hire, follow, order, scene, thumb, sections, names, townHTML, act, setView: (v) => { view = v; } };
})();
