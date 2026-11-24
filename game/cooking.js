/* Fishing and cooking. Fish where there's water nearby (rivers, lakes, the Sea of Ghosts) with a rod
   from any general store, then cook at an inn's pot or your own campfire. Cooked dishes give timed buffs
   (they use the same s.fx list as potions). Recipes and fish are Skyrim's; buff numbers are [OURS]. */
const COOK = (() => {
  const nowS = () => Date.now() / 1000;
  const FOOD = {
    // fish (raw)
    fish_salmon: { name: "Salmon Meat", value: 6, weight: 0.1 }, fish_perch: { name: "Silverside Perch", value: 15, weight: 0.25 },
    fish_betty: { name: "River Betty", value: 15, weight: 0.25 }, fish_histcarp: { name: "Histcarp", value: 6, weight: 0.25 },
    fish_spadetail: { name: "Cyrodilic Spadetail", value: 15, weight: 0.25 }, fish_longfin: { name: "Abecean Longfin", value: 15, weight: 0.5 },
    fish_slaughterfish: { name: "Slaughterfish Scales", value: 3, weight: 0.1 }, fish_mudcrab: { name: "Mudcrab Chitin", value: 2, weight: 0.25 },
    // the general store's larder
    food_salt: { name: "Salt Pile", value: 2, weight: 0.2 }, food_potato: { name: "Potato", value: 1, weight: 0.1 },
    food_leek: { name: "Leek", value: 4, weight: 0.1 }, food_cabbage: { name: "Cabbage", value: 2, weight: 0.25 },
    food_carrot: { name: "Carrot", value: 1, weight: 0.1 }, food_horker: { name: "Horker Meat", value: 3, weight: 0.5 },
    food_venison: { name: "Venison", value: 4, weight: 0.1 }, food_tomato: { name: "Tomato", value: 4, weight: 0.1 },
    fishing_rod: { name: "Fishing Rod", value: 30, weight: 3, slot: "misc" },
  };
  // name, ingredients [item, qty] (an "any fish" slot is "fish"), buffs [[key, mag, minutes]], what it does
  const RECIPES = {
    veg_soup: ["Vegetable Soup", [["food_cabbage", 1], ["food_potato", 1], ["food_leek", 1], ["food_tomato", 1]], [["regen:stamina", 50, 20], ["regen:health", 25, 20]], "Stamina and health come back faster"],
    salmon_steak: ["Salmon Steak", [["fish_salmon", 1], ["food_salt", 1]], [["max:stamina", 20, 20]], "+20 stamina"],
    horker_stew: ["Horker Stew", [["food_horker", 1], ["ing_garlic", 1], ["ing_lavender", 1], ["food_salt", 1]], [["max:health", 20, 30], ["regen:health", 50, 30]], "+20 health, heals faster"],
    venison_stew: ["Venison Stew", [["food_venison", 1], ["food_potato", 1], ["food_leek", 1], ["food_salt", 1]], [["max:stamina", 30, 30], ["regen:stamina", 25, 30]], "+30 stamina, recovers faster"],
    fish_stew: ["Fisherman's Stew", [["fish", 2], ["food_potato", 1], ["food_salt", 1]], [["carry", 50, 30]], "Carry 50 more"],
    fish_soup: ["Hot Fish Soup", [["fish", 1], ["food_leek", 1], ["food_carrot", 1]], [["warmth", 1, 30], ["regen:health", 25, 30]], "Snow and blizzards slow you half as much"],
  };
  const FISH = Object.keys(FOOD).filter((k) => k.startsWith("fish_"));
  const CATCH = {   // what bites where; weights
    river: [["fish_salmon", 30], ["fish_betty", 20], ["fish_perch", 20], ["fish_slaughterfish", 8], ["fish_mudcrab", 6]],
    lake: [["fish_histcarp", 30], ["fish_perch", 20], ["fish_spadetail", 18], ["fish_slaughterfish", 10], ["fish_mudcrab", 8]],
    sea: [["fish_longfin", 30], ["fish_salmon", 12], ["fish_slaughterfish", 14], ["fish_mudcrab", 14]],
  };
  const RARE = new Set(["fish_spadetail", "fish_longfin", "fish_betty", "fish_perch"]);
  const CAMP_MIN = 10;

  function addItems() {
    for (const [id, f] of Object.entries(FOOD)) if (!D.ITEMS[id]) D.ITEMS[id] = { slot: "food", ...f, raw: true };
    for (const [id, [name, , buffs, what]] of Object.entries(RECIPES)) D.ITEMS["dish_" + id] = { name, slot: "food", value: 20 + buffs.length * 10, weight: 0.5, dish: id, desc: what };
    const g = D.SHOP_STOCK.general;
    for (const id of ["fishing_rod", "food_salt", "food_potato", "food_leek", "food_cabbage", "food_carrot", "food_tomato", "food_horker", "food_venison"]) if (!g.includes(id)) g.push(id);
  }

  /* is there water to fish in near this spot? -> "river" | "lake" | "sea" | null */
  function waterNear(pos) {
    const T = Terrain.T, sx = 1 / Terrain.GW, sy = 1 / Terrain.GH, seen = {};
    for (let dx = -7; dx <= 7; dx++) for (let dy = -7; dy <= 7; dy++) {
      if (dx * dx + dy * dy > 49) continue;
      const t = Terrain.typeAtPos([pos[0] + dx * sx, pos[1] + dy * sy]);
      if (t === T.RIVER || t === T.BRIDGE) seen.river = 1; else if (t === T.LAKE) seen.lake = 1; else if (t === T.SEA) seen.sea = 1;
    }
    return seen.lake ? "lake" : seen.river ? "river" : seen.sea ? "sea" : null;
  }
  const hasRod = (s) => s.inv.some((r) => r.item === "fishing_rod");
  function canFish(s, pos) {
    if (s.trip?.status === "travel" || s.trip?.status === "encounter") return { err: "Stop walking first." };
    if (s.dungeon) return { err: "No fishing in a dungeon." };
    const w = waterNear(pos);
    if (!w) return { err: "There's no water close enough. Try a town by a lake, river or the sea." };
    if (!hasRod(s)) return { err: "You need a fishing rod. General stores sell them." };
    return { water: w };
  }
  /* the mini-game: a needle sweeps a bar; the green zone is narrower for better fish.
     -> { item, zone:[from,to] } describes the bite; caught(s, bite, needle) settles it */
  function bite(water) {
    const list = CATCH[water] || CATCH.river, total = list.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total, item = list[0][0];
    for (const [id, w] of list) { if ((r -= w) <= 0) { item = id; break; } }
    const ez = typeof A11Y !== "undefined" && A11Y.zoneEase ? A11Y.zoneEase() : 1;   // Settings → Accessibility → Easy timing
    const rare = RARE.has(item), width = Math.min(0.5, (rare ? 0.18 : 0.28) * ez), from = 0.1 + Math.random() * (0.8 - width);
    return { item, rare, zone: [from, from + width] };
  }
  function reel(s, b, needle) {
    const hit = needle >= b.zone[0] && needle <= b.zone[1];
    if (!hit) return { ok: false, text: ["It got away.", "The line goes slack. Gone.", "A splash, and nothing on the hook."][Math.floor(Math.random() * 3)] };
    G.give(s, b.item);
    s.stats = { ...(s.stats || {}), fish: ((s.stats || {}).fish || 0) + 1 };
    return { ok: true, item: b.item, text: `You land a ${D.ITEMS[b.item].name}!` };
  }

  // ---- cooking
  const atInn = (s) => !!(s.location && TOWNS.INNS[s.location]);
  const campLit = (s, t = nowS()) => !!(s.camp && s.camp.until > t && G.pxDist(s.camp.pos, [s.x, s.y]) < 12);
  function makeCamp(s, t = nowS()) {
    if (s.trip?.status === "travel" || s.trip?.status === "encounter") return "Stop walking first.";
    if (s.location && TOWNS.isTown(s.location)) return "Use the cooking pot at the inn.";
    if (campLit(s, t)) return "Your fire is already burning.";
    const wood = s.inv.find((r) => r.item === "mat_firewood");
    if (!wood) return "You need Firewood. Blacksmiths sell it.";
    G.take(s, wood.id, 1);
    s.camp = { pos: [s.x, s.y], until: t + CAMP_MIN * 60 };
    return `You build a small fire. It'll burn for about ${CAMP_MIN} minutes.`;
  }
  const canCook = (s) => atInn(s) || campLit(s);
  const countOf = (s, id) => (id === "fish" ? s.inv.filter((r) => FISH.includes(r.item) && r.item !== "fish_slaughterfish" && r.item !== "fish_mudcrab").reduce((a, r) => a + r.qty, 0) : s.inv.filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0));
  const missing = (s, id) => RECIPES[id][1].filter(([it, q]) => countOf(s, it) < q).map(([it, q]) => `${q > 1 ? q + " " : ""}${it === "fish" ? "fish" : D.ITEMS[it].name}`);
  function takeN(s, id, q) {
    const rows = id === "fish" ? s.inv.filter((r) => FISH.includes(r.item) && r.item !== "fish_slaughterfish" && r.item !== "fish_mudcrab") : s.inv.filter((r) => r.item === id);
    for (const r of rows) { if (q <= 0) break; const n = Math.min(q, r.qty); G.take(s, r.id, n); q -= n; }
  }
  function cook(s, id) {
    const rc = RECIPES[id]; if (!rc) return "There's no such recipe.";
    if (!canCook(s)) return "You need an inn's cooking pot or a campfire.";
    const miss = missing(s, id); if (miss.length) return `You still need: ${miss.join(", ")}.`;
    for (const [it, q] of rc[1]) takeN(s, it, q);
    G.give(s, "dish_" + id);
    if (typeof WFX !== "undefined") WFX.warmUp(s, 40);   // sitting by the fire
    return `You cook ${rc[0]}. It's in your pack. Eat it when you need it: ${rc[3].toLowerCase()} for ${rc[2][0][2]} minutes.`;
  }
  /* eat cooked food (buffs) or raw food (a little health) */
  function eatFood(s, rowId, t = nowS()) {
    const r = G.invRow(s, rowId), it = r && D.ITEMS[r.item];
    if (!it || it.slot !== "food" || r.item === "fishing_rod") return "You can't eat that.";
    G.take(s, rowId, 1);
    if (!it.dish) { G.setHealth(s, G.curHealth(s, t) + 5, t); return `You eat the ${it.name}. A little better (+5 health).`; }
    const rc = RECIPES[it.dish];
    s.fx = (s.fx || []).filter((f) => f.until > t && f.src !== "food");   // a new meal replaces the last one
    for (const [key, mag, min] of rc[2]) s.fx.push({ key, mag, until: t + min * 60, name: rc[0], src: "food" });
    G.setHealth(s, G.curHealth(s, t) + 15, t);
    return `You eat the ${rc[0]}. ${rc[3]} for ${rc[2][0][2]} minutes.`;
  }
  addItems();
  return { FOOD, RECIPES, FISH, CATCH, CAMP_MIN, waterNear, hasRod, canFish, bite, reel, atInn, campLit, makeCamp, canCook, missing, countOf, cook, eatFood };
})();
