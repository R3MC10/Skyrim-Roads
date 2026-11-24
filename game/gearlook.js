/* GEARLOOK: what every piece of gear looks like, data-driven. [OURS]
   One table of armour sets (colours + silhouette features) and one table of weapon materials. Any item id maps to a
   set by an explicit entry or by its name, so new items get a look automatically. Used by HEROART (paper doll, portraits),
   FIGHTART (fight figures), FXART (travel walkers) and the gear preview, so everyone sees the same real gear.
   API: GEARLOOK.setOf(id) → set key · GEARLOOK.set(key) → set record · GEARLOOK.of(id) → { set, slot, wk, s }
        GEARLOOK.person(look) → options for FIGHTART person() · GEARLOOK.walker(look) → colours for travel walkers
        GEARLOOK.SETS / GEARLOOK.list() for tests and line-up sheets. */
const GEARLOOK = (() => {
  // c body colour, d shade, trim edge/metal accents; w: "heavy" | "light" | "robe" | "cloth"; metal: shiny shading;
  // f: features → fur (fur trim), horns, spikes, ridges, scales, bone, plates, rivets, chain, gem (chest gem), sash, tabard,
  //    hood, cape (cape colour), glow (glow colour), seg (chitin segments), translucent, gears (dwemer), feathers, crown
  const SETS = {
    cloth:      { n: "Clothes",            c: "#b9a07a", d: "#8f7a5a", trim: "#d8c6a0", w: "cloth" },
    hide:       { n: "Hide",               c: "#8a6a48", d: "#5e4630", trim: "#c9b48f", w: "light", f: { fur: 1 } },
    fur:        { n: "Fur",                c: "#9a8266", d: "#6a5640", trim: "#e0d2b8", w: "light", f: { fur: 2 } },
    leather:    { n: "Leather",            c: "#7a5232", d: "#553823", trim: "#a87a50", w: "light", f: { sash: "#553823" } },
    studded:    { n: "Studded",            c: "#6e4c30", d: "#4c3420", trim: "#b5bbc0", w: "light", f: { rivets: 1 } },
    scaled:     { n: "Scaled",             c: "#8a7a52", d: "#5e5236", trim: "#c9b06a", w: "light", f: { scales: 1 } },
    elven:      { n: "Elven",              c: "#c9a75e", d: "#8f7a3c", trim: "#e8d48a", w: "light", metal: 1, f: { gem: "#8fb070", ridges: 1 } },
    glass:      { n: "Glass",              c: "#9fd8a8", d: "#5e9a72", trim: "#e0f6e4", w: "light", metal: 1, f: { translucent: 1, ridges: 1 } },
    chitin:     { n: "Chitin",             c: "#8a7a3e", d: "#5e5226", trim: "#c9b45a", w: "light", f: { seg: 1 } },
    stalhrim:   { n: "Stalhrim",           c: "#a8d4ea", d: "#6a9ab4", trim: "#e8f8ff", w: "light", metal: 1, f: { translucent: 1, spikes: 1, fur: 1 } },
    dragonscale:{ n: "Dragonscale",        c: "#c8c0a8", d: "#8a8270", trim: "#efe6cc", w: "light", f: { scales: 2, bone: 1 } },
    forsworn:   { n: "Forsworn",           c: "#6b4a2e", d: "#4a3220", trim: "#a8442e", w: "light", f: { feathers: 1, bone: 1, fur: 1 } },
    guild:      { n: "Thieves Guild",      c: "#3b3330", d: "#262120", trim: "#6b5640", w: "light", f: { hood: "#2a2422", sash: "#1c1714" } },
    nightingale:{ n: "Nightingale",        c: "#2a2a30", d: "#18181c", trim: "#5a4a7a", w: "light", f: { hood: "#1c1c22", cape: "#22222a", glow: "#8a6ad0" } },
    shrouded:   { n: "Dark Brotherhood",   c: "#3a2226", d: "#22141a", trim: "#8e2b25", w: "light", f: { hood: "#2a1418", sash: "#5a1a1a" } },
    chain:      { n: "Chainmail",          c: "#8d949a", d: "#646a70", trim: "#b5bbc0", w: "heavy", metal: 1, f: { chain: 1 } },
    iron:       { n: "Iron",               c: "#6f6a64", d: "#4d4945", trim: "#8f8a84", w: "heavy", metal: 1, f: { rivets: 1, horns: 1 } },
    banded:     { n: "Banded Iron",        c: "#76706a", d: "#4f4a46", trim: "#a39d96", w: "heavy", metal: 1, f: { plates: 2, rivets: 1 } },
    steel:      { n: "Steel",              c: "#a9b0b4", d: "#7d858a", trim: "#d0d5d8", w: "heavy", metal: 1, f: { plates: 1, fur: 1 } },
    steelplate: { n: "Steel Plate",        c: "#b8c0c6", d: "#858d94", trim: "#e2e6e9", w: "heavy", metal: 1, f: { plates: 2 } },
    nord:       { n: "Ancient Nord",       c: "#5e6b5a", d: "#3f4a3d", trim: "#8a9480", w: "heavy", metal: 1, f: { ridges: 2, horns: 1 } },
    nordic:     { n: "Nordic Carved",      c: "#9aa4a8", d: "#6a7478", trim: "#d6b25e", w: "heavy", metal: 1, f: { ridges: 1, fur: 1 } },
    orcish:     { n: "Orcish",             c: "#5f6b4a", d: "#3e4630", trim: "#8a9a6a", w: "heavy", metal: 1, f: { spikes: 1, plates: 1 } },
    dwarven:    { n: "Dwarven",            c: "#c08a3c", d: "#8f6328", trim: "#e0b060", w: "heavy", metal: 1, f: { gears: 1, plates: 1 } },
    bonemold:   { n: "Bonemold",           c: "#cbbf9e", d: "#9a8e6e", trim: "#8e2b25", w: "heavy", f: { bone: 2, plates: 1 } },
    ebony:      { n: "Ebony",              c: "#3a3138", d: "#221c22", trim: "#6a5a6a", w: "heavy", metal: 1, f: { ridges: 2, spikes: 1 } },
    daedric:    { n: "Daedric",            c: "#2a1c1e", d: "#160e10", trim: "#c4372e", w: "heavy", metal: 1, f: { spikes: 2, horns: 2, glow: "#e0402a" } },
    dragonplate:{ n: "Dragonplate",        c: "#d8d0bc", d: "#a09884", trim: "#f2ead6", w: "heavy", f: { bone: 2, spikes: 1, plates: 2 } },
    imperial:   { n: "Imperial",           c: "#8a3a2a", d: "#5e261c", trim: "#c9a75e", w: "heavy", metal: 1, f: { tabard: "#8a3a2a", plates: 1 } },
    stormcloak: { n: "Stormcloak",         c: "#5e6e88", d: "#3e4a5e", trim: "#c9b48f", w: "light", f: { sash: "#2f4f8a", fur: 2 } },
    robe:       { n: "Mage robes",         c: "#5a4a7a", d: "#3d3256", trim: "#c9a75e", w: "robe", f: { hood: "#4a3c6a" } },
    robe_dest:  { n: "Destruction robes",  c: "#8a2e22", d: "#5e1e16", trim: "#e8923a", w: "robe", f: { hood: "#6e241a" } },
    robe_rest:  { n: "Restoration robes",  c: "#d8c9a0", d: "#a89a72", trim: "#d6b25e", w: "robe", f: { hood: "#c4b48a" } },
    robe_alt:   { n: "Alteration robes",   c: "#3e6a5a", d: "#2a4a3e", trim: "#a8d4c0", w: "robe", f: { hood: "#30564a" } },
    robe_conj:  { n: "Conjuration robes",  c: "#4a2a5a", d: "#30183e", trim: "#b08ad8", w: "robe", f: { hood: "#3a2048" } },
    robe_ill:   { n: "Illusion robes",     c: "#3a4a8a", d: "#26305e", trim: "#c9b6ff", w: "robe", f: { hood: "#2e3c72" } },
    arch:       { n: "Archmage robes",     c: "#2f3a6a", d: "#1f274a", trim: "#d6b25e", w: "robe", f: { hood: "#26305a", glow: "#9fd0f0" } },
    necro:      { n: "Necromancer robes",  c: "#26221e", d: "#161310", trim: "#8fd08a", w: "robe", f: { hood: "#1c1814", bone: 1 } },
    miraak:     { n: "Miraak's robes",     c: "#4a5a2a", d: "#2e3a18", trim: "#c9b45a", w: "robe", f: { hood: "#3a4820", glow: "#d6c25a", feathers: 0 } },
    wood:       { n: "Wood",               c: "#7a5232", d: "#553823", trim: "#a87a50", w: "cloth" },
  };
  // artifacts, uniques and odd names → set
  const EXPLICIT = {
    mage_robes: "robe", archmage_robes: "arch", miraak_robes: "miraak", u_nightcaller_robes: "necro", miraak_sword: "miraak",
    saviors_hide: "fur", ebony_mail: "ebony", ebony_blade_greatsword: "ebony", wuuthrad: "ebony", u_ysgramor_armor: "nordic",
    stormcloak_officer_armor: "stormcloak", imperial_officer_helmet: "imperial", masque_clavicus: "daedric",
    u_bleakfalls_helm: "nord", u_folgunthur_helm: "nord", u_labyrinthian_mask: "nord", u_wolfskull_staffhood: "forsworn", u_hagsend_hood: "forsworn",
    u_pinewatch_gloves: "leather", u_alftand_gauntlets: "dwarven", u_swindler_boots: "leather", u_volunruud_greaves: "nord", u_ragnvald_boots: "nord",
    u_raldbthar_shield: "dwarven", u_northwatch_shield: "elven", spellbreaker: "dwarven", u_embershard_pick: "iron", u_mzulft_bow: "dwarven",
    u_ustengrav_blade: "nord", u_forelhost_axe: "nord", u_deepwood_bow: "elven", u_valtheim_sword: "steel",
    nightingale_blade: "nightingale", blade_of_woe: "shrouded", volendrung_warhammer: "dwarven", mehrunes_razor_dagger: "daedric",
    dawnbreaker: "steelplate", molag_bal_mace: "daedric", skyforge_steel_sword: "nordic", skyforge_steel_greatsword: "nordic", skyforge_steel_dagger: "nordic",
    dragonbone_dagger: "dragonplate", dragonbone_war_axe: "dragonplate", chainmail_coif: "chain", crossbow_dwarven: "dwarven", crossbow_dwarven_enhanced: "dwarven",
  };
  // name prefixes (first match wins) → set
  const PREFIX = [
    [/^archmage/, "arch"], [/^miraak/, "miraak"], [/necromanc|^robe_necro|nightcaller/, "necro"], [/destruction|^robe_dest/, "robe_dest"], [/restoration|^robe_rest/, "robe_rest"],
    [/alteration|^robe_alt/, "robe_alt"], [/conjuration|^robe_conj/, "robe_conj"], [/illusion|^robe_ill/, "robe_ill"], [/robe/, "robe"], [/^guild/, "guild"], [/^nightingale/, "nightingale"], [/^shrouded|^dark_brotherhood/, "shrouded"],
    [/^stalhrim/, "stalhrim"], [/^chitin/, "chitin"], [/^bonemold/, "bonemold"], [/^dragonscale/, "dragonscale"], [/^dragonplate|^dragonbone/, "dragonplate"],
    [/^daedric|^mask_/, "daedric"], [/^ebony/, "ebony"], [/^glass/, "glass"], [/^orcish/, "orcish"], [/^dwarven|dwemer/, "dwarven"], [/^elven/, "elven"],
    [/^ancient_nord/, "nord"], [/^nordic|^skyforge/, "nordic"], [/^forsworn/, "forsworn"], [/^steel_plate/, "steelplate"], [/^banded/, "banded"], [/^scaled/, "scaled"],
    [/^studded/, "studded"], [/^imperial/, "imperial"], [/^stormcloak/, "stormcloak"], [/^chainmail/, "chain"], [/^steel/, "steel"], [/^fur/, "fur"],
    [/^hide/, "hide"], [/^leather/, "leather"], [/^(hunting_bow|long_bow|staff_|crossbow)/, "wood"], [/^iron/, "iron"],
  ];
  const baseOf = (id) => (id && String(id).startsWith("ench|") ? String(id).split("|")[1] : id);
  const cache = new Map();
  function setOf(id) {
    id = baseOf(id) || "";
    if (!id) return "cloth";
    if (cache.has(id)) return cache.get(id);
    let k = EXPLICIT[id];
    if (!k) for (const [re, s] of PREFIX) if (re.test(id)) { k = s; break; }
    if (!k) {   // fall back on the item's own weight class
      const it = (typeof D !== "undefined" && D.ITEMS[id]) || {};
      const nm = String(it.name || "").toLowerCase();
      for (const [re, s] of PREFIX) if (re.test(nm.replace(/\s+/g, "_"))) { k = s; break; }
      if (!k) k = it.type === "heavy" ? "steel" : it.type === "light" ? "leather" : it.type === "cloth" ? "robe" : "iron";
    }
    cache.set(id, k); return k;
  }
  const set = (k) => SETS[k] || SETS.iron;
  function wkOf(id) {
    id = baseOf(id) || ""; if (!id) return null;
    if (/^staff_/.test(id)) return "staff"; if (/crossbow/.test(id)) return "crossbow"; if (/warhammer|volendrung/.test(id)) return "warhammer";
    if (/^wuuthrad/.test(id)) return "battleaxe";
    try { return G.wtype(id); } catch { return null; }
  }
  function of(id) {
    const k = setOf(id), it = (typeof D !== "undefined" && D.ITEMS[baseOf(id)]) || {};
    return { set: k, s: set(k), slot: it.slot || null, wk: it.slot === "weapon" ? wkOf(id) : null };
  }
  const list = () => Object.keys(SETS).filter((k) => k !== "wood");

  /* fight figure options (FIGHTART person) from a published look */
  function person(L) {
    const eq = L?.eq || {};
    const ch = eq.chest ? set(setOf(eq.chest)) : null, hd = eq.head ? set(setOf(eq.head)) : null, hk = eq.head ? setOf(eq.head) : null;
    const hn = eq.hands ? set(setOf(eq.hands)) : null, ft = eq.feet ? set(setOf(eq.feet)) : null, sh = eq.shield ? set(setOf(eq.shield)) : null;
    const robe = ch && ch.w === "robe";
    let head = "hair", helmColor = null, hoodColor = null;
    if (eq.head) {
      if (/^mask_/.test(baseOf(eq.head))) head = "mask";
      else if (hd.f?.hood || /hood/.test(eq.head)) { head = "hood"; hoodColor = hd.f?.hood || hd.c; }
      else if (hd.f?.horns || /iron_helmet|ancient_nord|daedric/.test(eq.head)) { head = "horned"; helmColor = hd.c; }
      else { head = "helm"; helmColor = hd.c; }
    } else if (ch?.f?.hood && (robe || /nightingale|shrouded|guild/.test(setOf(eq.chest)))) { head = "hood"; hoodColor = ch.f.hood; }
    const o = {
      body: ch ? ch.c : "#8a7a62", armC: hn ? hn.c : ch && ch.w === "heavy" ? ch.d : null, pants: robe ? null : ch ? (ch.w === "heavy" ? ch.d : ch.d) : "#5a4836",
      boots: ft ? ft.c : null, legs: robe ? "robe" : "legs", head, helmColor, hoodColor, helmSet: hk,
      shield: !!eq.shield, shieldColor: sh ? sh.c : null, shieldTrim: sh ? sh.trim : null, shieldShape: sh ? (sh.w === "heavy" && !/^(iron|hide)/.test(setOf(eq.shield)) ? "kite" : "round") : null,
      gear: ch ? { set: setOf(eq.chest), ...ch } : null, glow: !!L?.gl?.w, aglow: !!L?.gl?.a,
      cape: cloakC(eq) || ch?.f?.cape || (ch && ch.w === "heavy" ? "#7a2a22" : null), wt: wkOf(eq.weapon) || "fist", wmat: eq.weapon ? set(setOf(eq.weapon)) : null,
    };
    return o;
  }
  /* small travel figure colours */
  /* a side cloak (cloaks.js) colours the cape */
  const cloakC = (eq) => (eq && eq.cloak && typeof D !== "undefined" && D.ITEMS[eq.cloak]?.cloakLook?.c) || null;
  function walker(L) {
    const eq = L?.eq || {}, ch = eq.chest ? set(setOf(eq.chest)) : null;
    return {
      body: ch ? ch.c : "#6b5640", trim: ch ? ch.trim : "#8f7a66", dark: ch ? ch.d : "#4d3c2c", heavy: !!ch && ch.w === "heavy", robe: !!ch && ch.w === "robe",
      fur: !!ch?.f?.fur, cape: cloakC(eq) || ch?.f?.cape || (ch?.f?.hood ? ch.f.hood : "#8e2b25"), hood: !!(ch?.f?.hood && !eq.head),
      helm: eq.head ? set(setOf(eq.head)).c : null, horns: !!(eq.head && set(setOf(eq.head)).f?.horns), shield: eq.shield ? set(setOf(eq.shield)).c : null,
      weapon: eq.weapon ? set(setOf(eq.weapon)).trim : null, glow: L?.gl?.w ? true : !!ch?.f?.glow, glowC: ch?.f?.glow || "#c9b6ff",
    };
  }
  return { SETS, EXPLICIT, setOf, set, of, wkOf, person, walker, list, baseOf };
})();
