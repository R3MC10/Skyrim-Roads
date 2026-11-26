/* Item rarity [OURS] (owner decision 25 Nov 2026): every item is Common, Fine, Rare, Epic or Legendary.
   ONE place decides it, so every screen agrees (Items, paper doll, tooltips, shops, loot, loot votes, trade, the reward line).
   Rarity says how good and how special a thing is. It NEVER changes a number: no stat, price or drop chance is touched here.
   Four separate things, kept apart on purpose:
     - rarity     : this file, read from what the item already is
     - item level : the gear's own stats (iron < steel < elven ...), untouched
     - enchantment: what it does (enchanting.js / enchants2.js)
     - unique     : one of a kind (RARITY.unique). A named item is NOT automatically Legendary.
   How it is read (RARITY.of):
     1. an explicit `rarity` field on the item, or an entry in OVERRIDE, wins
     2. true artifacts are Legendary: Daedric artifacts, dragon priest masks, quest relics, legendary hunt trophies' gear,
        and the six signature uniques that only elite foes and bosses drop (very rarely)
     3. enchanted gear is Fine, Rare or Epic by how strong its magic really is (magnitude against the effect's full strength,
        added up over all its effects); staffs by the spell they hold. One-of-a-kind pieces are at least Rare.
     4. plain gear is Common or Fine: Fine for the better metals (elven, dwarven, orcish, glass, ebony, daedric, dragon...),
        gems on jewellery, or craftsmanship on your own row (tempered at the forge, or a masterful/perfect forging)
     5. everything else (potions, food, ingredients, ore, gems, tomes...) goes by what it is worth.
   Random drops don't roll a separate rarity: the foe's loot tables (engine.js rollLoot, jewelry.js, enchants2.js) already
   decide which item drops, and its rarity comes from the item. tests/test_rarity.js checks the result is about
   Common 60 / Fine 25 / Rare 12 / Epic 2.7 / Legendary 0.3 for road foes, and better for elites and bosses.
   Colours live in CSS (index.html, "rarity" block): .q-common .q-fine .q-rare .q-epic .q-legendary, and .rar-<key> on icons. */
const RARITY = (() => {
  const LIST = ["common", "fine", "rare", "epic", "legendary"];
  const NAME = { common: "Common", fine: "Fine", rare: "Rare", epic: "Epic", legendary: "Legendary" };
  const WEAR = new Set(["weapon", "shield", "head", "chest", "hands", "feet", "ring", "amulet", "cloak"]);
  /* explicit choices where reading the data alone would be wrong */
  const OVERRIDE = {
    gauldur_amulet: "legendary",   // a main quest relic, made whole again
    spellbreaker: "legendary",     // Peryite's artifact (it isn't flagged dae)
    wuuthrad: "legendary",         // Ysgramor's own axe
    blade_of_woe: "epic",          // the Dark Brotherhood's old blade
    mask_wooden: "fine",           // the wooden mask is a key, not a dragon priest's mask
    golden_claw: "rare", dragonstone: "rare", dwemer_lexicon: "rare",   // quest things: special, but not loot
    // the signature uniques from enchants2.js: only elite foes and bosses drop them, about 1 in 500 fights each
    u_stormcaller_fang: "legendary", u_red_wolf_tooth: "legendary", u_hearthburner: "legendary", u_wyrmsplitter: "legendary",
    u_briarheart_mail: "legendary", u_lucky_fox_ring: "legendary",
  };
  const FINE_METAL = /skyforge|daedric|dragonbone|dragonscale|dragonplate|dragon |stalhrim|ebony|glass|elven|orcish|dwarven|falmer|nightingale|ancient shrouded|nordic|ancient nord|scaled|steel plate|bonemold|chitin|moonstone|forsworn/;
  const LEGEND_PREFIX = /^lh_/;   // gear from the legendary hunts (leghunt.js): one beast, one piece

  const baseId = (id) => (String(id).startsWith("ench|") ? String(id).split("|")[1] : String(id));
  const itemOf = (id) => (typeof D !== "undefined" && D.ITEMS && id != null ? D.ITEMS[id] : null) || null;
  const valid = (r) => (LIST.includes(String(r || "").toLowerCase()) ? String(r).toLowerCase() : null);
  const rank = (r) => Math.max(0, LIST.indexOf(r));
  const up = (r, n = 1) => LIST[Math.min(LIST.length - 1, rank(r) + n)];
  const atLeast = (r, min) => (rank(r) >= rank(min) ? r : min);

  /* true artifacts */
  function artifact(id, it) {
    if (it.dae) return true;
    if (it.mask && it.mask !== "wooden" && id !== "mask_wooden") return true;
    if (LEGEND_PREFIX.test(id) && WEAR.has(it.slot)) return true;
    if (it.noTrade && (it.value || 0) >= 1000 && WEAR.has(it.slot)) return true;   // Miraak's gear, Ebony Mail, Savior's Hide, Volendrung...
    return false;
  }
  /* one of a kind: can't be bought, made or broken down for its magic (shown next to the rarity, never instead of it) */
  function unique(x) {
    const id = typeof x === "object" && x ? x.item : x, it = itemOf(id); if (!it) return false;
    return !!(it.unique || artifact(id, it) || OVERRIDE[id] === "legendary");
  }

  /* how strong an item's magic is: 1.0 = one effect at its full strength; several effects add up */
  function fullOf(eff, key) {
    if (typeof ENCH === "undefined") return 0;
    if (eff && ENCH.WEAPON && ENCH.WEAPON[eff]) return ENCH.WEAPON[eff][1];
    if (eff && ENCH.ARMOR && ENCH.ARMOR[eff]) return ENCH.ARMOR[eff][2];
    if (key && ENCH.ARMOR) for (const v of Object.values(ENCH.ARMOR)) if (v[1] === key) return v[2];
    return 0;
  }
  /* effects that change a fight far more than their number says (enchants2.js keeps these rarer on its loot tables too) */
  const POTENT = { paralyze: 1.75, chain_lightning: 1.75, bloodthirst: 1.75, echo: 1.75, banishing: 1.75, thunderclap: 1.75, last_ward: 1.75, mana_shield: 1.75, thorns: 1.75 };
  function strength(id, it = itemOf(id)) {
    if (!it) return 0;
    let s = 0;
    const e = it.enchant;
    if (e) s += Math.min(1.5, (e.magnitude || 0) / (e.max_magnitude || fullOf(e.effect) || 30)) * (POTENT[e.effect] || 1);
    const a = it.aenchant;
    if (a) for (const x of [a, ...(a.more || [])]) {
      const eff = x.eff || (String(id).startsWith("ench|") && x === a ? String(id).split("|")[2] : null), full = fullOf(eff, x.key);
      s += full ? Math.min(1.5, (x.mag || 0) / full) * (POTENT[eff] || 1) : 0.5;   // an odd effect with no scale (immunity, a cloak) counts as half
    }
    return s;
  }
  const byStrength = (s) => (s >= 0.7 ? "epic" : s >= 0.5 ? "rare" : "fine");
  const staffRarity = (it) => ((it.value || 0) >= 1000 ? "epic" : (it.value || 0) >= 400 ? "rare" : "fine");
  const byValue = (v) => (v >= 400 ? "epic" : v >= 150 ? "rare" : v >= 60 ? "fine" : "common");

  /* craftsmanship on your own copy: tempered at the forge, or a masterful/perfect forging (craftgames.js) */
  const crafted = (row) => !!row && ((row.tq || 0) >= 1 || /great|masterful|perfect/i.test(String(row.mw || "")));

  /* the rarity of an item (id, or an inventory row {item, tq, mw}); row is optional */
  function of(x, row) {
    if (x && typeof x === "object") { row = row || x; x = x.item; }
    const id = x == null ? "" : String(x), it = itemOf(id);
    if (!it) return "common";
    const set = valid(it.rarity) || valid(OVERRIDE[id]);
    if (set) return set;
    if (artifact(id, it)) return "legendary";
    const wear = WEAR.has(it.slot) || it.slot === "ammo";
    if (!wear) return byValue(it.value || 0);
    let r;
    if (it.staff) r = staffRarity(it);
    else if (it.enchant || it.aenchant) r = byStrength(strength(id, it));
    else {
      const n = String(it.name || id).toLowerCase(), b = baseId(id);
      const jewelFine = (it.slot === "ring" || it.slot === "amulet") && (!!it.gem || (it.tier || 0) >= 4);
      r = FINE_METAL.test(n) || FINE_METAL.test(b.replace(/_/g, " ")) || jewelFine ? "fine" : "common";
      if (r === "common" && (crafted(row) || it.noTrade)) r = "fine";   // your own fine work, or a keepsake/prize no shop sells
    }
    if (it.unique) r = atLeast(r, "rare");
    return r;
  }
  const name = (r) => NAME[r] || NAME.common;
  const label = (x, row) => name(of(x, row));
  const cls = (x, row) => "q-" + of(x, row);
  /* a short text tag (colour-blind safe): nothing for Common, "Rare", "Epic · Unique" ... */
  function tag(x, row, o = {}) {
    const r = of(x, row), u = unique(x && typeof x === "object" ? x.item : x);
    if (r === "common" && !u && !o.all) return "";
    return `<i class="rar q-${r}" data-rar="${r}">${NAME[r]}${u ? ` · <span class="rar-u">Unique</span>` : ""}</i>`;
  }
  /* the line under an item's name in its detail and tooltip: "Rare · Unique" */
  const line = (x, row) => { const id = x && typeof x === "object" ? x.item : x; return name(of(x, row)) + (unique(id) ? " · Unique" : ""); };
  /* the colour key in the ⓘ help */
  const legend = (sw) => LIST.map((r) => sw("q-" + r, NAME[r])).join("") + sw("q-unique", "Unique");

  /* share of each rarity in a list of item ids (tests and the balance report use it) */
  function share(ids) {
    const n = { common: 0, fine: 0, rare: 0, epic: 0, legendary: 0 }; let t = 0;
    for (const id of ids) { const it = itemOf(id); if (!it || !WEAR.has(it.slot)) continue; n[of(id)]++; t++; }
    for (const k of LIST) n[k] = t ? n[k] / t : 0;
    n.total = t; return n;
  }
  return { LIST, NAME, OVERRIDE, WEAR, of, rank, up, unique, strength, name, label, cls, tag, line, legend, share, crafted };
})();
