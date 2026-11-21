/* Fair crafting [OURS]: closes the classic Elder Scrolls crafting loops and adds recipes you find in the world.
   - Repeating the same craft gives less and less XP (no more 500 iron daggers). It recovers with in-game time.
   - Things you make sell for no more than their materials were worth (potions a little more), so
     buy → craft → sell can't print gold. The value travels with the item through chests, stalls, gifts and trades.
   - Fortify Smithing / Alchemy / Enchanting bonuses stack only up to +30, and Fortify-crafting potions are
     brewed from your real Alchemy skill, so fortify effects can't feed themselves.
   - Recipe scrolls turn up in barrows, Forsworn camps, on tough foes and at a few smiths. Reading one unlocks
     special forge recipes.
   - Anything you forge can carry a name you give it. */
const CRAFTFAIR = (() => {
  const FORTIFY_CAP = 30;                                   // most a craft skill can be raised by potions, gear and blessings
  const CRAFT_SKILLS = ["Smithing", "Alchemy", "Enchanting"];
  const REPEAT_DECAY = 3600 / G.GAME_SPEED;                 // one "repeat" wears off per in-game hour
  const REPEAT_STEP = 0.75, REPEAT_FLOOR = 0.1;             // each recent repeat: ×0.75 XP, never below 10%
  const POTION_MARKUP = 1.25;                               // brewed potions may sell for a bit more than their ingredients
  const UNKNOWN_BREW = 0.3;                                 // brewed potions of unknown origin sell for 30% of value
  const NAME_MAX = 24;

  // ---- 1. fortify crafting bonuses are capped (G.skill is what every crafting module reads)
  const rawSkill = G.skill;
  G.skill = (s, name) => {
    const v = rawSkill(s, name);
    if (!CRAFT_SKILLS.includes(name) || !s.skills?.[name]) return v;
    const base = s.skills[name].lvl;
    return base + Math.min(FORTIFY_CAP, v - base);
  };
  const fortifyBonus = (s, name) => G.skill(s, name) - s.skills[name].lvl;

  // ---- 2. repeat crafting: diminishing XP
  function repeatMult(s, key, t = G.now(), bump = true) {
    const log = (s.craftLog = s.craftLog || {});
    const e = log[key] || { n: 0, t };
    const n = Math.max(0, e.n - (t - e.t) / REPEAT_DECAY);
    const mult = Math.max(REPEAT_FLOOR, REPEAT_STEP ** n);
    if (bump) {
      log[key] = { n: n + 1, t };
      const keys = Object.keys(log);                         // keep the save small
      if (keys.length > 60) for (const k of keys.sort((a, b) => log[a].t - log[b].t).slice(0, keys.length - 60)) delete log[k];
    }
    return mult;
  }
  function scaledXp(mult, fn) {                             // run fn with every XP award scaled
    const orig = G.useSkill;
    G.useSkill = (s, name, xp) => orig(s, name, CRAFT_SKILLS.includes(name) ? xp * mult : xp);
    try { return fn(); } finally { G.useSkill = orig; }
  }

  // ---- 3. crafted value travels with the item ("cv" = what one unit's materials were worth)
  const isBrew = (item) => String(item).startsWith("brew|");
  const cvOf = (r) => (r?.cv != null ? r.cv : isBrew(r?.item) && D.ITEMS[r.item] ? D.ITEMS[r.item].value * UNKNOWN_BREW : null);
  /* copy cv and name from a source row onto the row an item was just given into (merging stacks fairly) */
  function carry(s, rowId, src, added = src?.qty || 1) {
    const r = G.invRow(s, rowId); if (!r || !src) return r;
    if (src.nm) r.nm = src.nm;
    const c = cvOf(src);
    if (c == null && r.cv == null) return r;
    const unit = (x) => (x == null ? D.ITEMS[r.item].value : x);
    if (r.qty > added) { const old = cvOf(r); r.cv = (unit(old) * (r.qty - added) + unit(c) * added) / r.qty; }
    else if (c != null) r.cv = c;
    return r;
  }
  const pack = (r) => (r.cv != null || r.nm ? { cv: r.cv, nm: r.nm } : {});   // extra fields for row copies
  function sellValue(row, v) {
    const c = cvOf(row);
    if (c == null) return v;
    return Math.min(v, c * (isBrew(row.item) ? POTION_MARKUP : 1));
  }
  const matValue = (mats) => mats.reduce((a, [i, n]) => a + (D.ITEMS[i]?.value || 0) * n, 0);
  const newRows = (s, before) => s.inv.filter((r) => !before.has(r.id));

  // ---- 4. recipe scrolls and the special recipes they unlock
  const SETS = {
    ancient_nord: { name: "Ancient Nord Smithing", value: 150, hint: "Found in old Nordic barrows.",
      items: (id) => /^ancient_nord_/.test(id), mats: (it) => [["mat_steel", Math.max(1, Math.min(5, Math.round(it.value / 40)))], ["mat_iron", 1], ["mat_strips", it.slot === "weapon" ? 1 : 2]] },
    forsworn: { name: "Forsworn Crafts", value: 120, hint: "Carried by Forsworn in the Reach.",
      items: (id) => /^forsworn_/.test(id), mats: (it) => [["mat_leather", Math.max(1, Math.min(4, Math.round(it.weight / 3)))], ["mat_strips", 2], ["mat_iron", 1]] },
    skyforge: { name: "Skyforge Steel", value: 400, hint: "Eorlund Gray-Mane sells it at the Skyforge in Whiterun.", perk: "steel_smithing",
      items: (id) => /^skyforge_/.test(id), mats: (it) => [["mat_steel", it.hands === 2 ? 5 : 3], ["mat_iron", 2], ["mat_strips", 2]] },
    dragon: { name: "Dragon Smithing", value: 900, hint: "Very rare. Only the strongest foes carry it.", perk: "dwarven_smithing",
      items: (id) => /^dragon(bone|scale)_/.test(id), mats: null },
  };
  // new gear only these recipes make ([OURS] stats sit between steel/dwarven and Skyrim's dragon gear)
  Object.assign(D.ITEMS, {
    skyforge_steel_sword: { name: "Skyforge Steel Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 11, weight: 12, value: 160 },
    skyforge_steel_greatsword: { name: "Skyforge Steel Greatsword", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 19, weight: 20, value: 260 },
    skyforge_steel_dagger: { name: "Skyforge Steel Dagger", slot: "weapon", hands: 1, skill: "One-Handed", damage: 6, weight: 3.5, value: 90 },
    dragonbone_dagger: { name: "Dragonbone Dagger", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 6.5, value: 600 },
    dragonbone_war_axe: { name: "Dragonbone War Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 17, weight: 21, value: 1100 },
    dragonscale_helmet: { name: "Dragonscale Helmet", slot: "head", type: "light", armor: 17, weight: 4, value: 750 },
    dragonscale_boots: { name: "Dragonscale Boots", slot: "feet", type: "light", armor: 12, weight: 3, value: 600 },
  });
  for (const [k, st] of Object.entries(SETS)) D.ITEMS["recipe_" + k] = { name: `Recipe: ${st.name}`, slot: "recipe", weight: 0.5, value: st.value, recipe: k };
  if (!SMITH.GROUPS.some(([g]) => g === "found")) SMITH.GROUPS.push(["found", "Found recipes"]);
  for (const [id, it] of Object.entries(D.ITEMS)) {
    if (id.startsWith("ench|") || it.enchant || it.aenchant || !(it.slot === "weapon" || G.ARMOR_SLOTS.includes(it.slot))) continue;
    for (const [k, st] of Object.entries(SETS)) if (st.items(id)) {
      const mats = id.startsWith("dragonbone") ? [["dragon_bone", it.slot === "weapon" ? 2 : 3], ["mat_strips", 2]] : id.startsWith("dragonscale") ? [["dragon_scales", 2], ["mat_strips", 2]] : st.mats(it);
      if (mats.every(([m]) => D.ITEMS[m])) SMITH.RECIPES[id] = { group: "found", mats, perk: st.perk || null, needs: k };
    }
  }
  // where the scrolls turn up
  D.LOOT.elite.push(["recipe_ancient_nord", 0.01], ["recipe_forsworn", 0.01], ["recipe_dragon", 0.003]);
  DUNGEONS.THEMES.barrow?.loot.push("recipe_ancient_nord");
  DUNGEONS.THEMES.forsworn?.loot.push("recipe_forsworn");
  D.TOWN_STOCK = D.TOWN_STOCK || {};
  const addStock = (town, shop, items) => { D.TOWN_STOCK[town] = D.TOWN_STOCK[town] || {}; D.TOWN_STOCK[town][shop] = [...new Set([...(D.TOWN_STOCK[town][shop] || []), ...items])]; };
  addStock("Whiterun", "blacksmith", ["recipe_skyforge"]);
  addStock("Markarth", "blacksmith", ["recipe_forsworn"]);

  const knows = (s, k) => (s.recipes || []).includes(k);
  const foundNote = (s, esc = (x) => x) => `<p class="sub">📜 Special recipes come from recipe scrolls found in the world. Read one from your pack to learn it.</p>` +
    Object.entries(SETS).map(([k, st]) => `<p class="sub">${knows(s, k) ? "✅" : "🔒"} <b>${esc(st.name)}</b>${knows(s, k) ? " (known)" : ` · ${esc(st.hint)}`}</p>`).join("");
  function read(s, rowId) {
    const r = G.invRow(s, rowId), it = r && D.ITEMS[r.item];
    if (!it || it.slot !== "recipe") return "That isn't a recipe.";
    const st = SETS[it.recipe];
    if (knows(s, it.recipe)) return `You already know ${st.name}.`;
    G.take(s, rowId);
    s.recipes = [...(s.recipes || []), it.recipe];
    const made = Object.keys(SMITH.RECIPES).filter((id) => SMITH.RECIPES[id].needs === it.recipe).map((id) => D.ITEMS[id].name);
    return `📜 You study the ${it.name}. New forge recipes: ${made.join(", ")}.${st.perk ? ` (Needs the ${(typeof PERKS !== "undefined" && PERKS.BY_ID[st.perk]?.name) || st.perk} perk.)` : ""}`;
  }

  // ---- 5. naming what you made
  const canName = (r) => !!r && r.cv != null && !isBrew(r.item) && (D.ITEMS[r.item]?.slot === "weapon" || G.ARMOR_SLOTS.includes(D.ITEMS[r.item]?.slot));
  const clean = (t) => String(t || "").replace(/[<>"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  function rename(s, rowId, text) {
    const r = G.invRow(s, rowId);
    if (!canName(r)) return "Only gear you forged yourself can carry your name for it.";
    const n = clean(text);
    if (!n) { delete r.nm; return `It's just a ${D.ITEMS[r.item].name} again.`; }
    r.nm = n;
    return `You carve “${n}” into your ${D.ITEMS[r.item].name}.`;
  }
  const label = (r) => r?.nm ? `“${r.nm}”` : null;   // shown alongside the item's real name

  // ---- 6. wrap the crafting actions
  const rawMake = SMITH.make;
  SMITH.make = (s, id) => {
    const rc = SMITH.RECIPES[id];
    if (rc?.needs && !knows(s, rc.needs)) return `You don't know how to make that yet. Find the ${D.ITEMS["recipe_" + rc.needs].name}. ${SETS[rc.needs].hint}`;
    const before = new Set(s.inv.map((r) => r.id));
    const pre = SMITH.atForge(s) && rc && !SMITH.info(s, id)?.block;
    const mult = pre ? repeatMult(s, "smith:" + id) : 1;
    const out = scaledXp(mult, () => rawMake(s, id));
    if (/^You make/.test(out) && rc) { const cv = matValue(rc.mats) / (rc.out || 1); for (const r of newRows(s, before)) if (r.item === id) r.cv = cv; }
    return out + (pre && mult < 0.99 ? ` (Making the same thing again teaches you less: ${Math.round(mult * 100)}% XP.)` : "");
  };
  const rawInfo = SMITH.info;
  SMITH.info = (s, id) => {
    const i = rawInfo(s, id); if (!i) return i;
    if (i.needs && !knows(s, i.needs)) i.block = `Needs the ${D.ITEMS["recipe_" + i.needs].name}. ${SETS[i.needs].hint}`;
    i.xpMult = repeatMult(s, "smith:" + id, G.now(), false);
    return i;
  };
  const rawEnchant = ENCH.enchant;
  ENCH.enchant = (s, rowId, eff, gemRowId) => {
    const r = G.invRow(s, rowId), g = G.invRow(s, gemRowId);
    const src = r && { cv: cvOf(r) ?? D.ITEMS[r.item].value, temper: r.temper, nm: r.nm }, gemV = g ? D.ITEMS[g.item]?.value || 0 : 0;
    const before = new Set(s.inv.map((x) => x.id));
    const mult = repeatMult(s, "ench:" + eff + ":" + (r?.item || ""), G.now(), false);
    const out = scaledXp(mult, () => rawEnchant(s, rowId, eff, gemRowId));
    const made = newRows(s, before).filter((x) => String(x.item).startsWith("ench|"));
    if (made.length) {
      repeatMult(s, "ench:" + eff + ":" + r.item);
      for (const x of made) { x.cv = src.cv + gemV; if (src.nm) x.nm = src.nm; }
    }
    return out + (made.length && mult < 0.99 ? ` (The same enchantment again teaches you less: ${Math.round(mult * 100)}% XP.)` : "");
  };
  const rawBrew = TOWNS.brew;
  TOWNS.brew = (s, rowIds) => {
    const rows = [...new Set(rowIds)].map((id) => G.invRow(s, id)).filter(Boolean);
    const ingV = rows.reduce((a, r) => a + (D.ITEMS[r.item]?.value || 0), 0);
    const key = "brew:" + rows.map((r) => r.item).sort().join("+");
    const qtyOf = () => Object.fromEntries(s.inv.filter((x) => isBrew(x.item)).map((x) => [x.id, x.qty]));
    const q0 = qtyOf(), cv0 = Object.fromEntries(s.inv.filter((x) => isBrew(x.item)).map((x) => [x.id, cvOf(x)]));
    const mult = repeatMult(s, key, G.now(), false);
    const res = scaledXp(mult, () => rawBrew(s, rowIds));
    const q1 = qtyOf();
    for (const [id, q] of Object.entries(q1)) {
      const added = q - (q0[id] || 0); if (added <= 0) continue;
      const r = G.invRow(s, +id), old = cv0[id] ?? null;
      r.cv = q0[id] ? ((old ?? r.cv ?? 0) * q0[id] + ingV * added) / q : ingV;
      repeatMult(s, key);
      if (mult < 0.99 && res?.text) res.text += ` (The same brew again teaches you less: ${Math.round(mult * 100)}% XP.)`;
    }
    return res;
  };

  return { FORTIFY_CAP, CRAFT_SKILLS, REPEAT_DECAY, POTION_MARKUP, SETS, NAME_MAX, fortifyBonus, repeatMult, cvOf, carry, pack, sellValue, matValue, knows, foundNote, read, canName, rename, label, rawSkill };
})();
