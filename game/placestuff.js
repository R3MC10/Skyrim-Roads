/* Something at every place [OURS]. Towns have shops, dungeons have monsters and loot, stones have blessings,
   but farms, cabins, shrines, groves and old ruins used to be just a picture. Now each one offers something,
   picked to fit what it is, and it comes back on a timer so the place stays worth a visit:
   - Farm stall: a few fresh things for sale (a little stock each day).        - Chores: an hour's work for a few coins and some produce (daily).
   - Local job: the farmer/innkeeper wants a nearby dungeon cleared or a bag carried (the town job list, s.jobs).
   - Shrine blessing: heals you and gives one blessing at a time (daily); shrines also reset your perks (perkreset.js). - Hidden stash: a strongbox to pick (lockpicking mini-game; every 3 days).
   - Search the ruins: a few coins, often a lore book or a scroll (every 3 days). - Herb spot: rare ingredients (every 2 days, like plant patches).
   - Ore: Raven Rock Mine joins the  mines.
   Every place without anything else falls back to an offer by its kind, so new places are never empty (tests/test_fullmap.js).
   Perks: Wayfarer's Nose (Lockpicking) and Pilgrim (Restoration) in perkfx.js. */
const PLACESTUFF = (() => {
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const DAY = 2 * 3600, HOUR = DAY / 24;   // one in-game day = 2 real hours
  const COOL = { chores: DAY, bless: DAY, stash: 3 * DAY, search: 3 * DAY, grove: 2 * DAY };
  const STASH_FAIL = 2 * HOUR;             // snapped your picks: the lock waits a couple of in-game hours
  const itemOk = (i) => typeof D !== "undefined" && !!D.ITEMS[i];
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);

  // ------------------------------------------------------------------ what each place offers
  // stall themes: [item, base qty a day]
  const STALLS = {
    farm: [["food_cabbage", 3], ["food_potato", 4], ["food_leek", 2], ["food_carrot", 3], ["food_tomato", 2], ["ing_wheat", 2], ["food_salt", 2]],
    mill: [["mat_firewood", 6], ["ing_wheat", 3], ["food_potato", 2], ["food_salt", 2]],
    vineyard: [["ing_jazbay", 4], ["food_cabbage", 2], ["food_leek", 2], ["ing_wheat", 2]],
    inn: [["dish_veg_soup", 2], ["dish_venison_stew", 1], ["dish_horker_stew", 1], ["food_venison", 2], ["potion_health_minor", 2]],
    meadery: [["dish_venison_stew", 2], ["ing_bee", 3], ["ing_wheat", 3], ["potion_stamina", 1]],
    lodge: [["pelt_wolf", 1], ["mat_leather", 2], ["potion_health", 1], ["gold_ring", 1]],
    hunter: [["pelt_wolf", 2], ["food_venison", 3], ["mat_leather", 2], ["ing_hawk_feathers", 1]],
  };
  const GROVES = {
    default: [["ing_blue_flower", 3], ["ing_lavender", 3], ["ing_purple_flower", 2], ["ing_elves_ear", 1], ["ing_hanging_moss", 2], ["ing_nirnroot", 1], ["ing_luna_moth", 1]],
    sacred: [["ing_nirnroot", 2], ["ing_elves_ear", 2], ["ing_glowing_mushroom", 2], ["ing_luna_moth", 2], ["ing_scaly_pholiota", 1], ["ing_crimson_nirnroot", 1]],
    sol: [["ing_ash_yam", 3], ["ing_ash_creep", 1], ["ing_scathecraw", 1], ["ing_trama_root", 1], ["ing_spawn_ash", 1]],
  };
  // blessings: [title, fx key, magnitude, what it does]. Shrines heal you too; one blessing at a time, like Skyrim.
  const BLESS = {
    "Shrine of Talos": ["Blessing of Talos", "max:health", 25, "+25 health"],
    "Shrine of Azura": ["Azura's Dusk", "regen:magicka", 50, "Magicka comes back 50% faster"],
    "Shrine of Mehrunes Dagon": ["Dagon's Fury", "dmg:weapon", 10, "Your weapon hits 10% harder"],
    "Statue to Meridia": ["Meridia's Light", "resist", 15, "15% less damage from magic"],
    "Shrine of Boethiah": ["Boethiah's Cunning", "skill:Sneak", 15, "+15 Sneak"],
    "Hall of the Vigilant": ["Stendarr's Ward", "resist", 10, "10% less damage from magic"],
    "Weynon Stones": ["Akatosh's Patience", "regen:stamina", 50, "Stamina comes back 50% faster"],
    "Earth Stone": ["Earth Stone's Strength", "max:health", 30, "+30 health"],
    "Water Stone": ["Water Stone's Calm", "regen:magicka", 50, "Magicka comes back 50% faster"],
    "Wind Stone": ["Wind Stone's Breath", "max:stamina", 30, "+30 stamina"],
    "Beast Stone": ["Beast Stone's Eye", "dmg:Archery", 10, "Bows hit 10% harder"],
    "Sun Stone": ["Sun Stone's Fire", "spell:Destruction", 10, "+10% Destruction"],
    "Tree Stone": ["Tree Stone's Root", "regen:health", 50, "Health comes back 50% faster"],
    default: ["Blessing of the Divines", "regen:health", 25, "Health comes back 25% faster"],
  };
  // hidden stashes: lock tier 0..4 (Novice..Master)
  const STASH = { "Meeko's Shack": 0, "Lund's Hut": 1, "Froki's Shack": 1, "Drelas' Cottage": 2, "Anise's Cabin": 1, "Dawnstar Sanctuary": 3, "Black-Briar Lodge": 3, "Nightingale Hall": 3, "Dark Brotherhood Sanctuary": 3 };
  const SEARCH_TEXT = {
    ruin: ["Behind a fallen stone you find a pouch someone hid and never came back for.", "Under the moss, an old offering bowl with coins still in it.", "A cracked urn. Most of it is dust. Not all of it."],
    camp: ["Between the bedrolls, someone's forgotten purse.", "A loose board hides a little cache."],
    sol: ["Ash has buried most of it, but something glints under the drift.", "A Skaal hunter's cache, wrapped in hide."],
  };
  // name → list of offers. Places not listed fall back by kind (BY_KIND) when nothing else is there.
  const OFFERS = {
    "Half-Moon Mill": ["stall:mill", "chores", "job:clear"], "Mixwater Mill": ["stall:mill", "chores", "job:clear"], "Heartwood Mill": ["stall:mill", "chores", "job:clear"],
    "Anga's Mill": ["stall:mill", "chores", "job:clear"], "Sarethi Farm": ["stall:vineyard", "chores", "job:clear"],
    "Shrine of Azura": ["bless"], "Shrine of Talos": ["bless"], "Shrine of Mehrunes Dagon": ["bless"], "Statue to Meridia": ["bless"], "Shrine of Boethiah": ["bless"],
    "Hall of the Vigilant": ["bless", "job:clear"], "Weynon Stones": ["bless", "search"],
    "Earth Stone": ["bless"], "Water Stone": ["bless"], "Wind Stone": ["bless"], "Beast Stone": ["bless"], "Sun Stone": ["bless"], "Tree Stone": ["bless", "grove:default"],
    "Night Gate Inn": ["stall:inn", "job:deliver"], "Honningbrew Meadery": ["stall:meadery", "chores", "job:deliver"], "Black-Briar Lodge": ["stash", "stall:lodge"],
    "Froki's Shack": ["stash", "stall:hunter"], "Meeko's Shack": ["stash"], "Lund's Hut": ["stash"], "Drelas' Cottage": ["stash"], "Anise's Cabin": ["stash", "grove:default"],
    "Dawnstar Sanctuary": ["stash"], "Dark Brotherhood Sanctuary": ["stash"], "Nightingale Hall": ["stash"],
    "Eldergleam Sanctuary": ["grove:sacred"], "Evergreen Grove": ["grove:sacred"], "Greenspring Hollow": ["grove:default", "search"], "Brodir Grove": ["grove:sol"],
    "Sky Haven Temple": ["search"], "The Midden": ["search"], "Kjenstag Ruins": ["search"], "Gjukar's Monument": ["search"], "Riverwood Folly": ["search"], "Frossel": ["search"],
    "Lakeview Manor": ["chores", "grove:default"],
  };
  const BY_KIND = { farm: ["stall:farm", "chores", "job:clear"], shrine: ["bless"], stone: ["bless"], landmark: ["search"] };

  // Raven Rock Mine joins the mines (ebony isn't in the game yet, so the Dunmer's usual iron and corundum, with a little gold)
  if (typeof SMITH !== "undefined" && SMITH.MINES && !SMITH.MINES["Raven Rock Mine"]) SMITH.MINES["Raven Rock Mine"] = ["Raven Rock Mine", [["ore_iron", 4], ["ore_corundum", 3], ["ore_gold", 1]]];

  const kindOf = (n) => (typeof WORLD !== "undefined" ? WORLD.places[n]?.[2] : null);
  /* does the place already offer something through another system? */
  function hasOther(n) {
    if (typeof TOWNS !== "undefined" && TOWNS.isTown(n)) return true;
    if (typeof G !== "undefined" && G.shopTypes(n).length) return true;
    if (typeof DUNGEONS !== "undefined" && DUNGEONS.enterable(n)) return true;
    if (typeof POWERS !== "undefined" && POWERS.STONE_AT[n]) return true;
    if (typeof SMITH !== "undefined" && SMITH.MINES[n]) return true;
    return n === "High Hrothgar";
  }
  function offers(n) {
    if (!n || typeof WORLD === "undefined" || !WORLD.places[n]) return [];
    if (OFFERS[n]) return OFFERS[n];
    if (hasOther(n)) return [];
    return BY_KIND[kindOf(n)] || ["search"];
  }
  const LABEL = { stall: " Stall", chores: " Chores", job: " Job", bless: " Blessing", stash: " Stash", search: " Search", grove: " Herbs" };
  const tag = (n) => { const o = offers(n); return o.length ? ` · ${[...new Set(o.map((x) => LABEL[x.split(":")[0]]))].join(", ")}` : ""; };

  // ------------------------------------------------------------------ state
  function st(s) { s.pstuff = s.pstuff || {}; return s.pstuff; }
  const at = (s, n) => (st(s)[n] = st(s)[n] || {});
  function left(s, n, type, t = now()) {
    const p = st(s)[n]; if (!p) return 0;
    if (type === "stash" && p.stashFail) { const f = p.stashFail + STASH_FAIL - t; if (f > 0) return f; }
    const last = p[type]; if (!last) return 0;
    const cool = type === "stash" ? COOL.stash - (pfx(s, "stash") > 0 ? DAY : 0) : COOL[type] || DAY;
    return Math.max(0, last + cool - t);
  }
  const lvl = (s) => s.level || 1;
  const giveSome = (s, id, n) => { if (!itemOk(id) || n <= 0) return null; G.give(s, id, n); return `${n > 1 ? n + " " : ""}${D.ITEMS[id].name}`; };
  const weighted = (list) => { const bag = list.flatMap(([id, w]) => Array(Math.max(1, w)).fill(id)).filter(itemOk); return bag.length ? pick(bag) : null; };
  const skillUp = (s, sk, xp) => (s.skills?.[sk] ? G.useSkill(s, sk, xp) : []);
  const here = (s, n) => n && s.location === n && !s.trip && !s.dungeon;

  // ------------------------------------------------------------------ chores: a day's honest work
  function chores(s, n = s.location, t = now()) {
    if (!here(s, n) || !offers(n).includes("chores")) return { err: "There's no work going here." };
    if (left(s, n, "chores", t)) return { err: "They've nothing more for you today. Come back tomorrow." };
    at(s, n).chores = t;
    const gold = Math.min(40, 10 + Math.round(lvl(s) * 0.8) + rint(0, 6));
    s.gold += gold;
    const stall = (offers(n).find((o) => o.startsWith("stall:")) || "stall:farm").split(":")[1];
    const mill = stall === "mill" || n === "Lakeview Manor";
    const got = [`${gold} gold`];
    if (mill) { const g = giveSome(s, "mat_firewood", 2); if (g) got.push(g); }
    const prod = weighted((STALLS[stall] || STALLS.farm).filter(([id]) => id.startsWith("food_") || id.startsWith("ing_")));
    if (prod) { const g = giveSome(s, prod, rint(1, 2)); if (g) got.push(g); }
    const sk = skillUp(s, mill ? "Two-Handed" : "Athletics", 3);
    const what = mill ? "You split logs until your arms ache." : stall === "meadery" ? "You haul barrels and stack crates in the cellar." : "You pull weeds, carry water and mend a fence.";
    return { text: `${what} They pay you ${got.join(", ")}.`, got, skills: sk };
  }

  // ------------------------------------------------------------------ shrine and stone blessings
  function blessOf(n) {
    const b = BLESS[n] || BLESS.default;
    return { title: b[0], key: b[1], mag: b[2], what: b[3] };
  }
  function bless(s, n = s.location, t = now()) {
    if (!here(s, n) || !offers(n).includes("bless")) return { err: "There's nothing to pray to here." };
    if (left(s, n, "bless", t)) return { err: "You've already been blessed here today." };
    at(s, n).bless = t;
    const b = blessOf(n);
    let key = b.key;
    if (key === "dmg:weapon") { const w = G.equipment(s).weapon; key = "dmg:" + (D.ITEMS[w?.item]?.skill || "One-Handed"); }
    const caged = typeof SOL !== "undefined" && SOL.STONES?.includes(n) && SOL.freed && !SOL.freed(s, n);
    const mag = caged ? Math.round(b.mag / 2) : b.mag, long = DAY * (1 + Math.min(1, pfx(s, "bless")));
    s.fx = (s.fx || []).filter((f) => f.until > t && f.src !== "shrine");   // one blessing at a time
    s.fx.push({ key, mag, until: t + long, name: b.title, src: "shrine" });
    G.setHealth(s, G.maxHealth(s));
    const cured = typeof CURSE !== "undefined" && CURSE.cureDisease ? CURSE.cureDisease(s) : "";
    const sk = skillUp(s, "Restoration", 6);
    return { text: `${caged ? "The black stone smothers most of it, but a little power seeps through." : "A calm settles over you and your wounds close."} ${b.title}: ${caged ? b.what.replace(/\d+/, (x) => String(Math.round(x / 2))) : b.what} for ${long >= 2 * DAY ? "two days" : "a day"}.${cured ? " " + cured : ""}`, skills: sk };
  }

  // ------------------------------------------------------------------ hidden stash (a strongbox to pick)
  const stashTier = (n) => STASH[n] ?? 1;
  function stashInfo(s, n = s.location) {
    const tier = stashTier(n);
    return { tier, tries: 3, chance: G.lockChance(s, tier) };
  }
  /* opened: true/false from the mini-game, or undefined to roll it the old way */
  function stash(s, n = s.location, opened, t = now()) {
    if (!here(s, n) || !offers(n).includes("stash")) return { err: "There's nothing locked away here." };
    if (left(s, n, "stash", t)) return { err: "The strongbox is empty for now. Someone will fill it again." };
    const inf = stashInfo(s, n);
    if (opened === undefined) { opened = false; for (let i = 0; i < inf.tries && !opened; i++) opened = G.lockRoll(s, inf.chance); }
    const sk = skillUp(s, "Lockpicking", opened ? 4 + inf.tier * 2 : 1);
    if (!opened) { at(s, n).stashFail = t; return { text: "Your last pick snaps in the lock. Better leave it a while before anyone notices.", fail: true, skills: sk }; }
    const p = at(s, n); p.stash = t; delete p.stashFail;
    const gold = Math.round((rint(20, 45) + inf.tier * 12 + Math.min(30, lvl(s))) * (1 + Math.min(0.5, pfx(s, "stash"))) * (1 + (G.P(s, "golden_touch") ? 0.1 : 0)));
    s.gold += gold;
    const got = [`${gold} gold`];
    const loot = weighted([["potion_health_minor", 4], ["potion_health", 2], ["potion_magicka", 2], ["scroll_healing", 1], ["soul_gem_common", 1]]);
    if (Math.random() < 0.6 && loot) { const g = giveSome(s, loot, 1); if (g) got.push(g); }
    if (Math.random() < 0.08 + inf.tier * 0.03) { const g = giveSome(s, pick(["gem_garnet", "gem_amethyst", "silver_ring"]), 1); if (g) got.push(g); }
    if (typeof IMM !== "undefined" && IMM.count) IMM.count(s, "secrets");
    return { text: `The lock clicks. Inside: ${got.join(", ")}.`, got, skills: sk };
  }

  // ------------------------------------------------------------------ search the ruins
  function search(s, n = s.location, t = now()) {
    if (!here(s, n) || !offers(n).includes("search")) return { err: "There's nothing to search here." };
    if (left(s, n, "search", t)) return { err: "You've turned this place over already. Give it a few days." };
    at(s, n).search = t;
    const sol = typeof WORLD !== "undefined" && WORLD.isSol?.(WORLD.places[n]);
    const gold = rint(8, 22) + Math.min(20, Math.round(lvl(s) / 2));
    s.gold += gold;
    const got = [`${gold} gold`];
    let book = null;
    if (typeof EXPLORE !== "undefined" && Math.random() < 0.4) { book = EXPLORE.randomLore(s); if (book) got.push(`a book: "${book.title}"`); }
    if (!book) { const g = giveSome(s, pick(["scroll_healing", "scroll_oakflesh", "potion_stamina", "potion_health_minor", "ing_bone_meal"]), 1); if (g) got.push(g); }
    if (typeof EXPLORE !== "undefined" && Math.random() < 0.05) { const id = EXPLORE.freshMap(s); if (id) { const g = giveSome(s, "map_" + id, 1); if (g) got.push(g); } }
    const sk = skillUp(s, "Sneak", 3);
    const line = pick(SEARCH_TEXT[sol ? "sol" : kindOf(n) === "camp" ? "camp" : "ruin"]);
    return { text: `${line} You find ${got.join(", ")}.`, got, book, skills: sk };
  }

  // ------------------------------------------------------------------ herb spot
  function grove(s, n = s.location, t = now()) {
    const o = offers(n).find((x) => x.startsWith("grove:"));
    if (!here(s, n) || !o) return { err: "Nothing grows here worth picking." };
    if (left(s, n, "grove", t)) return { err: "You've picked it clean. It grows back in a couple of days." };
    at(s, n).grove = t;
    const list = GROVES[o.split(":")[1]] || GROVES.default, mult = G.P(s, "green_thumb") ? 2 : 1, got = [];
    for (let i = rint(3, 4); i > 0; i--) { const id = weighted(list); const g = id && giveSome(s, id, mult); if (g) got.push(g); }
    const sk = skillUp(s, "Alchemy", 3);
    return { text: `You pick carefully, leaving the roots: ${got.join(", ") || "nothing ripe yet"}.`, got, skills: sk };
  }

  // ------------------------------------------------------------------ stalls: a little stock each day
  const day = (t = now()) => Math.floor(t / DAY);
  function seeded(seed) { let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function stock(s, n = s.location, t = now()) {
    const o = offers(n).find((x) => x.startsWith("stall:"));
    if (!o) return [];
    const r = seeded(n + day(t)), p = at(s, n);
    if (p.day !== day(t)) { p.day = day(t); p.bought = {}; }
    return (STALLS[o.split(":")[1]] || STALLS.farm).filter(([id, q]) => itemOk(id) && q > 0)
      .map(([id, q]) => ({ id, left: Math.max(0, Math.max(1, q - 1 + Math.floor(r() * 3)) - (p.bought[id] || 0)), price: price(s, id) }));
  }
  const price = (s, id) => Math.max(1, Math.round(G.buyPrice(s, id, null) * 1.1));   // travelling trader's markup
  function buy(s, id, n = s.location, t = now()) {
    if (!here(s, n)) return { err: "There's no stall here." };
    const row = stock(s, n, t).find((x) => x.id === id);
    if (!row) return { err: "They don't sell that." };
    if (row.left <= 0) return { err: "Sold out today. More tomorrow." };
    if (s.gold < row.price) return { err: `You need ${row.price} gold.` };
    s.gold -= row.price; G.give(s, id, 1);
    const p = at(s, n); p.bought[id] = (p.bought[id] || 0) + 1;
    return { text: `Bought ${D.ITEMS[id].name} for ${row.price} gold.`, bought: id };
  }

  // ------------------------------------------------------------------ local jobs (go into the same list as town jobs: s.jobs, paid by TOWNS.checkJobs)
  function jobOffer(s, n = s.location, t = now()) {
    const o = offers(n).find((x) => x.startsWith("job:"));
    if (!o || typeof TOWNS === "undefined") return null;
    const type = o.split(":")[1], dd = day(t), id = `${n}-${dd}-p${type[0]}`, pos = WORLD.places[n];
    if ((s.jobs || []).some((j) => j.id === id) || (s.jobsDone || []).includes(id)) return null;
    const r = seeded(id), pk = (a) => a[Math.floor(r() * a.length)];
    const pay = (G.P(s, "diplomat") ? 1.25 : 1) * (1 + Math.min(0.4, pfx(s, "job")));
    const giver = kindOf(n) === "farm" ? "The farmer" : n === "Hall of the Vigilant" ? "A Vigilant of Stendarr" : "The owner";
    if (type === "clear") {
      const near = Object.keys(WORLD.places).filter((d) => DUNGEONS.enterable(d) && !["camp", "lair"].includes(kindOf(d)) && WORLD.same(pos, WORLD.places[d]) && G.pxDist(pos, WORLD.places[d]) < 260);
      if (!near.length) return null;
      const d = pk(near), tier = DUNGEONS.info(d).tier;
      return { id, type: "clear", town: n, target: d, reward: Math.round((70 + 90 * tier) * pay), text: `${giver} asks you to clear out ${d}. "It's too close for comfort. I can't pay what the Jarl pays, but I'll pay."` };
    }
    const towns = Object.keys(WORLD.places).filter((d) => TOWNS.isTown(d) && WORLD.same(pos, WORLD.places[d]) && G.pxDist(pos, WORLD.places[d]) > 80 && G.pxDist(pos, WORLD.places[d]) < 500);
    if (!towns.length) return null;
    const d = pk(towns);
    return { id, type: "deliver", town: n, target: d, reward: Math.round((25 + G.pxDist(pos, WORLD.places[d]) / 7) * pay), text: `${giver} needs a parcel taken to ${d}. "Mind the bandits on the way."` };
  }
  function takeJob(s, n = s.location, t = now()) {
    if (!here(s, n)) return { err: "You need to be there." };
    const j = jobOffer(s, n, t);
    if (!j) return { err: "No work today. Try tomorrow." };
    if (typeof TOWNS !== "undefined" && TOWNS.wanted(s)) return { err: "Nobody will hire a wanted criminal." };
    s.jobs = s.jobs || [];
    if (s.jobs.length >= 3) return { err: "You already have three jobs. Finish one first." };
    s.jobs.push({ ...j, t });
    if (!s.discovered.includes(j.target)) s.discovered.push(j.target);
    return { text: `Job taken: ${j.type === "clear" ? `clear ${j.target}` : `take the parcel to ${j.target}`}. ${j.reward} gold when it's done.` };
  }

  // ------------------------------------------------------------------ the card under a place's picture
  const fmt = (sec) => { const m = Math.ceil(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + "m" : ""}`.trim() : `${m} min`; };
  const btn = (id, label, waitS, pri = true, extra = "") => waitS ? `<button class="btn sm" disabled>back in ${fmt(waitS)}</button>` : `<button class="btn sm ${pri ? "pri" : ""}" data-act="pstuff" data-id="${id}"${extra}>${label}</button>`;
  function card(s) {
    const n = s?.location;
    if (!n || s.trip || s.dungeon) return "";
    const list = offers(n); if (!list.length) return "";
    const t = now(), rows = [];
    const row = (ico, title, sub, b) => rows.push(`<div class="item pstuff-row"><span class="ps-i" aria-hidden="true">${ico}</span><div class="t">${title}<span>${sub}</span></div>${b}</div>`);
    for (const o of [...list].sort((a, b) => a.startsWith("stall:") - b.startsWith("stall:"))) {   // the stall's long list goes last
      const [type] = o.split(":");
      if (type === "chores") row("", "Lend a hand", "An hour's work for a few coins and something from the larder. Once a day.", btn("chores", "Work", left(s, n, "chores", t)));
      if (type === "bless") { const b = blessOf(n); row("", esc(b.title), `${esc(b.what)}${G.P(s, "pilgrim") ? " for two days" : " for a day"}, and your wounds close. One blessing at a time.`, btn("bless", "Pray", left(s, n, "bless", t))); }
      if (type === "stash") { const i = stashInfo(s, n), names = ["Novice", "Apprentice", "Adept", "Expert", "Master"]; row("", "A hidden strongbox", `${names[i.tier]} lock · Lockpicking ${G.skill(s, "Lockpicking")}. Refilled every few days.`, btn("stash", "Pick it", left(s, n, "stash", t))); }
      if (type === "search") row("", "Search the area", "Loose stones and old hiding places: coins, scrolls, sometimes a book. Every few days.", btn("search", "Search", left(s, n, "search", t), false));
      if (type === "grove") row("", "Herbs grow here", "Pick what's ripe. It grows back in two days.", btn("grove", "Gather", left(s, n, "grove", t)));
      if (type === "job") {
        const mine = (s.jobs || []).find((j) => j.town === n);
        const j = jobOffer(s, n, t);
        if (mine) row("", `Job: ${mine.type === "clear" ? `clear ${esc(mine.target)}` : `parcel to ${esc(mine.target)}`}`, `${mine.reward} gold when it's done. It's in your jobs list.`, "");
        else if (j) row("", "Someone needs help", `${esc(j.text)} · ${j.reward} gold`, btn("job", "Take the job", 0, false));
        else row("", "No work today", "Come back tomorrow, there's usually something.", "");
      }
      if (type === "stall") {
        const items = stock(s, n, t);
        rows.push(`<div class="item pstuff-row"><span class="ps-i" aria-hidden="true"></span><div class="t">A small stall<span>Fresh stock every day · you have ${s.gold} gold</span></div></div>`
          + items.map((x) => `<div class="item pstuff-buy">${typeof ICONART !== "undefined" ? ICONART.item(x.id, 30) : ""}<div class="t">${esc(D.ITEMS[x.id].name)}<span>${x.left ? `${x.left} left today` : "sold out"}</span></div><span class="num gold">${x.price}</span>${x.left && s.gold >= x.price ? `<button class="btn sm" data-act="pstuff" data-id="buy" data-item="${esc(x.id)}">Buy</button>` : `<button class="btn sm" disabled>Buy</button>`}</div>`).join(""));
      }
    }
    if (typeof PERKRESET !== "undefined") { const r = PERKRESET.row(s); if (r) rows.push(r); }   // shrines: reset your perks (perkreset.js)
    return `<div class="panel pstuff"><h2>What's here</h2><div class="list">${rows.join("")}</div></div>`;
  }

  /* one entry for the panel button. ui: { toast, openModal, persist, renderPanel, note } */
  function onClick(b, s, ui) {
    const id = b.dataset.id, n = s.location;
    const done = (r, title) => {
      if (r.err) return ui.toast(r.err);
      if (typeof SOUND !== "undefined") SOUND.fx(r.got || r.bought ? "coin" : "click");
      if (r.got && G.note) G.note(s, `${title}: ${r.text}`);
      for (const m of r.skills || []) ui.toast(m);
      ui.persist(true); ui.renderPanel(true);
      if (r.bought) return ui.toast(r.text);
      ui.openModal(`<h2>${esc(title)}</h2><p>${esc(r.text)}</p>${r.book ? `<button class="btn" data-act="xread" data-id="${esc(r.book.id)}" style="width:100%;margin-bottom:6px"> Read "${esc(r.book.title)}"</button>` : ""}<button class="btn pri" data-act="close" style="width:100%">Close</button>`);
    };
    if (id === "chores") return done(chores(s, n), ` ${n}`);
    if (id === "bless") return done(bless(s, n), ` ${n}`);
    if (id === "search") return done(search(s, n), ` ${n}`);
    if (id === "grove") return done(grove(s, n), ` ${n}`);
    if (id === "buy") return done(buy(s, b.dataset.item, n), n);
    if (id === "job") return done(takeJob(s, n), ` ${n}`);
    if (id === "stash") {
      if (left(s, n, "stash")) return ui.toast("The strongbox is empty for now.");
      if (typeof IMM !== "undefined" && IMM.wantsGame && IMM.wantsGame() && IMM.open) {
        const i = stashInfo(s, n);
        return IMM.open({ tier: i.tier, picks: i.tries, chance: i.chance, unbreakable: G.P(s, "unbreakable"), skill: G.skill(s, "Lockpicking"), title: `A strongbox at ${n}`, s },
          (res) => { if (!res.opened && !res.broken && !res.auto) return; done(stash(s, n, res.opened ? true : res.auto ? undefined : false), ` ${n}`); });
      }
      return done(stash(s, n), ` ${n}`);
    }
  }

  return { DAY, COOL, STALLS, GROVES, BLESS, STASH, OFFERS, BY_KIND, offers, hasOther, tag, left, chores, bless, blessOf, stash, stashInfo, search, grove, stock, buy, jobOffer, takeJob, card, onClick, st };
})();
if (typeof module !== "undefined") module.exports = PLACESTUFF;
