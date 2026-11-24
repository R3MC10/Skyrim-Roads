/* More unique enchantments. [OURS module] Owner: "more unique enchantments".
   Adds 12 weapon and 10 worn effects to the enchanting tables (enchanting.js), each doing something real in a fight:
   chain lightning, crits that heal, numbing cold that pushes a foe down the turn order, wildfire that grows, thorns,
   a ward that rises when you're nearly down, gold from the fallen, and more.
   How it plugs in (small, clear points; the fight engine itself isn't rewritten):
   - ENCH.WEAPON / ENCH.ARMOR / ENCH.PFXMAP get the new rows, so learning (disenchant), the arcane enchanter, item names,
     prices, tooltips and jewellery loot all work through the code that's already there. Old ids are untouched.
   - ENCH.onHit is wrapped: new weapon effects are handled here, old ones go to the old code (and Overcharge surges both).
   - PFX.tick is wrapped (venom, wildfire growing), and G.Fight's enemyTurn and apply are wrapped (thorns, Last Ward,
     Mana Shield, venom-weakened blows; Fortune's gold). tbfight.js asks ENCH2.numb(f) for Numbing Cold.
   - No one-shots: every new effect is a share of a blow, a small flat number or a chance with a rest after it; the
     turn-based fight's 40% cap on one action still applies on top. tests/test_enchants2.js checks each effect and runs a sim. */
const ENCH2 = (() => {
  if (typeof ENCH === "undefined" || typeof D === "undefined") return null;
  const J = ENCH.JEWEL_SLOTS || ["ring", "amulet"];
  /* weapon effects: [name, max magnitude, base cost, kind, item-name suffix, what it does ({m} = magnitude), perk class] */
  const WEAPON = {
    chain_lightning: ["Chain Lightning", 24, 18, "chain", "Storms", "{m} shock damage on a hit, then the bolt jumps back for half that, and 30% of the time jumps once more.", "shock"],
    bloodthirst: ["Bloodthirst", 30, 20, "thirst", "Bloodthirst", "Critical hits heal you for {m}% of the blow, other hits for a quarter of that. The blade also finds a critical 10% of the time by itself.", "rune"],
    numbing: ["Numbing Cold", 20, 16, "numb", "Numbing", "{m} frost damage on a hit. A numbed foe acts later in the turn order for 2 rounds and loses one of its moves (not bosses or dragons; once every 3 rounds).", "frost"],
    wildfire: ["Wildfire", 24, 15, "wild", "Wildfire", "{m} fire damage on a hit and sets them burning. The burn grows hotter every turn it keeps going, up to double.", "fire"],
    dragonbane: ["Dragonbane", 40, 18, "bane", "the Wyrm", "{m} extra damage to dragons, and half that to giants, trolls and mammoths.", "rune"],
    banishing: ["Banishing", 40, 22, "banish", "Banishing", "{m} extra damage to daedra and atronachs. A daedra (not a boss) below a fifth of its health is sent back to Oblivion.", "rune"],
    thunderclap: ["Thunderclap", 25, 20, "stagger", "Thunder", "{m}% chance a hit staggers them and they lose their next move (half as often on bosses and dragons; it needs a turn's rest after).", "rune"],
    reaping: ["Reaping", 20, 16, "reap", "Reaping", "{m} extra damage on a hit, three times that when the foe is below a quarter of its health.", "rune"],
    sundering: ["Sundering", 12, 14, "sunder", "Sundering", "{m} extra damage on a hit, and every hit cracks their guard a little more: up to twice that by the fifth hit.", "rune"],
    spellbreaker: ["Spellbreaker", 30, 20, "silence", "Silence", "{m} extra damage to mages, priests and other spellcasters, and a 25% chance to break the spell they were readying (they lose their next move).", "rune"],
    echo: ["Echo Strike", 25, 24, "echo", "Echoes", "{m}% chance the blow rings out again: a second strike for half its damage.", "rune"],
    venom: ["Venom", 10, 14, "venom", "Venom", "Poisons living foes for {m} damage a turn for 3 turns. It stacks up to 3 times, and a poisoned foe hits 10% softer.", "rune"],
  };
  /* worn effects: [name, key, magnitude at full strength, slots, cap when several are worn, perk class, suffix, what it does].
     e2:<id> keys are read here (ENCH.worn sums and caps them); pfx:<id> keys reach the fight code through PFXMAP below. */
  const ARMOR = {
    thorns: ["Thorns", "e2:thorns", 20, ["chest", "shield", ...J], 30, "relic", "Thorns", "Foes that hit you in close combat take {m}% of the blow back."],
    last_ward: ["Last Ward", "e2:lastward", 60, ["chest", "shield", "amulet"], 100, "relic", "the Last Ward", "Once a fight, when a blow drops you below a third of your health, a ward rises that soaks the next {m} damage."],
    fortune: ["Fortune", "e2:gold", 25, ["hands", ...J], 50, "relic", "Fortune", "Foes you beat drop {m}% more gold."],
    mana_shield: ["Mana Shield", "e2:manashield", 25, ["head", "chest", "amulet"], 40, "relic", "the Mana Shield", "{m}% of the damage you take comes out of your magicka instead, while you have magicka left."],
    swiftness: ["Swiftness", "pfx:swiftness", 4, ["feet", ...J], 6, "relic", "Swiftness", "+{m} initiative in turn-by-turn fights: you act sooner."],
    dragonward: ["Dragonward", "pfx:dragonward", 30, ["shield", "chest", "head", ...J], 50, "ward", "Dragonward", "Dragons hurt you {m}% less, breath and bite alike."],
    gravewarden: ["Gravewarden", "pfx:gravewarden", 25, ["shield", "chest", "head", ...J], 50, "ward", "the Gravewarden", "Draugr, skeletons, vampires and other undead hurt you {m}% less."],
    executioner: ["Executioner", "pfx:executioner", 20, ["hands", "ring"], 30, "relic", "the Executioner", "Your weapon blows do {m}% more damage to a foe below a quarter of its health."],
    huntsman: ["Huntsman", "pfx:huntsman", 20, ["hands", "head", "ring"], 30, "relic", "the Huntsman", "Your weapon blows do {m}% more damage to beasts: wolves, bears, trolls, spiders and the like."],
    ambusher: ["Ambusher", "pfx:ambusher", 30, ["hands", "feet", "ring"], 50, "relic", "the Ambush", "Your first weapon blow in a fight does {m}% more damage."],
  };
  const PFXMAP = {
    swiftness: [["tbinit", 1, {}]],
    dragonward: [["in", -0.01, { tag: ["dragon"] }]],
    gravewarden: [["in", -0.01, { tag: ["undead", "vampire"] }]],
    executioner: [["out", 0.01, { foeBelow: 0.25 }]],
    huntsman: [["out", 0.01, { tag: ["beast"] }]],
    ambusher: [["out", 0.01, { first: 1 }]],
  };
  for (const [k, v] of Object.entries(WEAPON)) if (!ENCH.WEAPON[k]) ENCH.WEAPON[k] = v;
  for (const [k, v] of Object.entries(ARMOR)) if (!ENCH.ARMOR[k]) { ENCH.ARMOR[k] = v; if (v[4] && ENCH.CAP) ENCH.CAP[v[1]] = v[4]; }
  for (const [k, v] of Object.entries(PFXMAP)) if (ENCH.PFXMAP && !ENCH.PFXMAP[k]) ENCH.PFXMAP[k] = v;
  const isNew = (eff) => !!(WEAPON[eff] || ARMOR[eff]);
  ENCH.short = (eff) => (WEAPON[eff] ? WEAPON[eff][0].toLowerCase() : eff);   // item summary line: "+18 chain lightning"

  /* ---- where to find them: enchanted gear on loot tables and the court wizards' shelves (rarer for the strong ones) */
  const has = (b) => !!D.ITEMS[b];
  const FOUND_W = [   // [base, effect, magnitude, charge]
    ["steel_sword", "chain_lightning", 10, 900], ["iron_war_axe", "bloodthirst", 12, 900], ["steel_mace", "numbing", 8, 800], ["iron_sword", "wildfire", 10, 900],
    ["long_bow", "dragonbane", 16, 900], ["steel_sword", "banishing", 16, 900], ["steel_battleaxe", "thunderclap", 10, 800], ["iron_greatsword", "reaping", 8, 900],
    ["steel_mace", "sundering", 5, 900], ["iron_dagger", "spellbreaker", 12, 900], ["elven_sword", "echo", 10, 800], ["iron_dagger", "venom", 4, 900],
  ].filter(([b]) => has(b));
  const FOUND_A = [   // [base, effect, magnitude]
    ["steel_armor", "thorns", 8], ["iron_shield", "last_ward", 25], ["leather_bracers", "fortune", 10], ["hide_helmet", "mana_shield", 10],
    ["leather_boots", "swiftness", 2], ["steel_shield", "dragonward", 12], ["iron_helmet", "gravewarden", 10], ["iron_gauntlets", "executioner", 8],
    ["hide_bracers", "huntsman", 8], ["leather_boots", "ambusher", 12],
  ].filter(([b]) => has(b));
  const STRONG = new Set(["chain_lightning", "bloodthirst", "echo", "banishing", "thunderclap", "last_ward", "mana_shield", "thorns"]);
  const idW = ([b, e, m, c]) => `ench|${b}|${e}|${m}|${c}`, idA = ([b, e, m]) => `ench|${b}|${e}|${m}|0`;
  const found = [...FOUND_W.map((r) => [idW(r), r[1]]), ...FOUND_A.map((r) => [idA(r), r[1]])];
  if (D.LOOT?.humanoid) D.LOOT.humanoid.push(...found.filter(([, e]) => !STRONG.has(e)).map(([id]) => [id, 0.003]));
  if (D.LOOT?.elite) D.LOOT.elite.push(...found.map(([id, e]) => [id, STRONG.has(e) ? 0.008 : 0.015]));
  if (D.SHOP_STOCK?.wizard) D.SHOP_STOCK.wizard.push(...found.filter(([, e]) => !STRONG.has(e)).filter((_, i) => i % 2 === 0).map(([id]) => id));

  /* ---- signature uniques: one of a kind (they can't be broken down), very rare from elite foes and bosses */
  const UQ = {
    u_stormcaller_fang: ["elven_sword", "Stormcaller's Fang", { effect: "chain_lightning", magnitude: 18, max_magnitude: 24, base_cost: 18, capacity: 1800 }, 900],
    u_red_wolf_tooth: ["iron_dagger", "Red Wolf's Tooth", { effect: "bloodthirst", magnitude: 24, max_magnitude: 30, base_cost: 20, capacity: 1600 }, 700],
    u_hearthburner: ["steel_battleaxe", "Hearthburner", { effect: "wildfire", magnitude: 18, max_magnitude: 24, base_cost: 15, capacity: 1600 }, 850],
    u_wyrmsplitter: ["elven_bow", "Wyrmsplitter", { effect: "dragonbane", magnitude: 32, max_magnitude: 40, base_cost: 18, capacity: 1600 }, 950],
  };
  const UQA = {
    u_briarheart_mail: ["steel_armor", "Briarheart Mail", [["thorns", 15], ["last_ward", 40]], 1100],
    u_lucky_fox_ring: ["gold_ring", "Ring of the Lucky Fox", [["fortune", 25], ["swiftness", 3]], 800],
  };
  for (const [id, [b, name, en, value]] of Object.entries(UQ)) if (has(b) && !D.ITEMS[id]) D.ITEMS[id] = { ...D.ITEMS[b], name, value, enchant: en, unique: true };
  for (const [id, [b, name, list, value]] of Object.entries(UQA)) {
    if (!has(b) || D.ITEMS[id]) continue;
    const row = ([e, m]) => ({ key: ARMOR[e][1], mag: m, name: ARMOR[e][0], eff: e });
    D.ITEMS[id] = { ...D.ITEMS[b], name, value, aenchant: { ...row(list[0]), more: list.slice(1).map(row) }, unique: true };
  }
  const UNIQUES = [...Object.keys(UQ), ...Object.keys(UQA)].filter((id) => D.ITEMS[id]);
  if (D.LOOT?.elite) D.LOOT.elite.push(...UNIQUES.map((id) => [id, 0.002]));

  /* ---- fight helpers */
  const rnd = () => Math.random();
  const BIG = (f) => !!(f.e?.boss || f.e?.priest || f.bf || f.tags.has("dragon") || f.tags.has("boss"));
  const maxE = (f) => f.e?.health || f.ehp0 || Math.max(1, f.ehp);
  const name = (f) => String(f.e?.name || "foe");
  const isDaedra = (f) => f.tags.has("daedra") || /atronach|dremora|daedr|scamp|seducer|mazken|aurorans?\b/i.test(name(f));
  const isCaster = (f) => (typeof MAGIC !== "undefined" && MAGIC.isCaster ? MAGIC.isCaster(f) && !f.tags.has("dragon") : f.tags.has("mage")) || !!f.e?.priest || !!f.fp?.caster;
  const living = (f) => !(f.tags.has("undead") || f.tags.has("construct") || isDaedra(f) || /skeleton|draugr|ghost|wraith|wisp|dwarven|centurion|sphere|spider(?=.*dwarven)/i.test(name(f)));
  const chillProof = (f) => /frost|ice|snow|draugr|skeleton|wraith/i.test(name(f)) || f.tags.has("construct");
  const giantish = (f) => /giant|troll|mammoth/i.test(name(f));
  const worn = (s, key) => (typeof ENCH !== "undefined" && s?.loadouts ? ENCH.worn(s, key) : 0);
  const pfxSum = (s, key, f) => (typeof PFX !== "undefined" ? PFX.sum(s, key, f, {}) : 0);

  /* Stackable statuses (combat2, PR #112: "apply N stacks of X", Burn N = N a turn, -1 stack a turn) aren't on main yet.
     Every status these enchantments put on goes through stack(): once a stack system exists (STACKS.add or
     STATUS.add(f, side, kind, n)) it takes over; until then it returns false and the older code below runs. */
  function stack(f, side, kind, n) {
    const api = (typeof STACKS !== "undefined" && STACKS) || (typeof STATUS !== "undefined" && STATUS) || null;
    if (!api || typeof api.add !== "function") return false;
    try { api.add(f, side, kind, Math.max(1, Math.round(n))); return true; } catch (e) { return false; }
  }

  /* a hit with a new weapon effect. f = fight, en = the weapon's enchant, em = magnitude this hit, ctx = { label, dmg } so far */
  function hit(f, en, em, ctx = {}) {
    const kind = WEAPON[en.effect][3], s = f.s;
    if (kind === "chain") {
      let d = em * 1.5, label = " \uE129 chain lightning";
      if (rnd() < 0.3) { d += em * 0.25; label += ", jumps twice"; }
      f.pendingEl = ["shock", em, "weapon"];
      return { dmg: d, label };
    }
    if (kind === "thirst") {
      let crit = /\(critical\)/.test(ctx.label || ""), extra = 0, label = "";
      if (!crit && rnd() < 0.1) { crit = true; extra = (f.weapon?.damage || 0) * 0.5; label = " (critical)"; }
      const heal = Math.max(0, Math.round(((ctx.dmg || 0) + extra) * em / 100 * (crit ? 1 : 0.25)));
      const mh = typeof G !== "undefined" ? G.maxHealth(s) : f.hp;
      const got = Math.max(0, Math.min(mh - f.hp, heal));
      if (got > 0) { f.hp += got; label += ` \uE11F drinks ${got}`; }
      return { dmg: extra, label };
    }
    if (kind === "numb") {
      if (chillProof(f)) return { dmg: em, label: " +frost" };
      if (stack(f, "foe", "chill", 2)) return { dmg: em, label: " \uE125 numbed" };   // chill 2
      f._numb = Math.max(f._numb || 0, (f.turn || 0) + 2);
      if (!f.tb) f.slowed = Math.max(f.slowed || 0, 1);   // quick fights (no turn order): its next blow lands softer instead
      return { dmg: em, label: " \uE125 numbed" };
    }
    if (kind === "wild") { if (stack(f, "foe", "burn", em / 3)) return { dmg: em, label: " \uE104 wildfire" }; f._wild = true; f.pendingEl = ["fire", em, "weapon"]; return { dmg: em, label: " \uE104 wildfire" }; }
    if (kind === "bane") {
      const k = f.tags.has("dragon") ? 1 : giantish(f) ? 0.5 : 0;
      return k ? { dmg: em * k, label: " +dragonbane" } : { dmg: 0, label: "" };
    }
    if (kind === "banish") {
      if (!isDaedra(f)) return { dmg: 0, label: "" };
      const left = f.ehp - (ctx.dmg || 0) - em;
      if (!BIG(f) && left > 0 && left < 0.2 * maxE(f)) return { dmg: f.ehp * 4, label: " ✧ banished to Oblivion" };   // ×4: through a foe's block or armor too
      return { dmg: em, label: " +banishing" };
    }
    if (kind === "stagger") {
      const ch = Math.min(0.3, em / 100) * (BIG(f) ? 0.5 : 1);
      if ((f._thunderCd || 0) > (f.turn || 0) || f.stagger || rnd() >= ch) return { dmg: 0, label: "" };
      f.stagger = true; f._thunderCd = (f.turn || 0) + 2;
      return { dmg: 0, label: ", \uE129 thunderclap staggers" };
    }
    if (kind === "reap") { const low = f.ehp < 0.25 * maxE(f); return { dmg: em * (low ? 3 : 1), label: low ? " +reaping (finishing)" : " +reaping" }; }
    if (kind === "sunder" && stack(f, "foe", "vulnerable", 1)) return { dmg: em, label: " +sunder" };
    if (kind === "sunder") { f._sunder = Math.min(5, (f._sunder || 0) + 1); return { dmg: em * (1 + 0.25 * (f._sunder - 1)), label: ` +sunder ×${f._sunder}` }; }
    if (kind === "silence") {
      if (!isCaster(f)) return { dmg: 0, label: "" };
      let label = " +spellbreaker";
      if (!f.stagger && (f._silenceCd || 0) <= (f.turn || 0) && rnd() < 0.25 * (BIG(f) ? 0.5 : 1)) { f.stagger = true; f._silenceCd = (f.turn || 0) + 3; label += ", their spell breaks"; }
      return { dmg: em, label };
    }
    if (kind === "echo") {
      if (rnd() >= Math.min(0.25, em / 100) || !(ctx.dmg > 0)) return { dmg: 0, label: "" };
      const d = ctx.dmg * 0.5;
      return { dmg: d, label: ` \uE15C echoes ${Math.round(d)}` };
    }
    if (kind === "venom") {
      if (!living(f)) return { dmg: 0, label: "" };
      if (stack(f, "foe", "poison", em)) return { dmg: 0, label: " \uE12E venom" };   // poison N
      const v = f._venom = f._venom || [];
      if (v.length >= 3) v.shift();
      v.push({ dmg: Math.max(1, Math.round(em)), turns: 3 });
      return { dmg: 0, label: ` \uE12E venom ×${v.length}` };
    }
    return { dmg: 0, label: "" };
  }
  const baseHit = ENCH.onHit;
  ENCH.onHit = function (f, en, em, ctx) {
    let surge = "";
    if (pfxSum(f.s, "enchsurge", f) > 0 && rnd() < pfxSum(f.s, "enchsurge", f)) { em *= 1.5; surge = " ✦ surge"; }   // Overcharge
    const r = WEAPON[en.effect] ? hit(f, en, em, ctx) : baseHit(f, en, em, ctx);
    return surge ? { dmg: r.dmg, label: surge + r.label } : r;
  };

  /* Numbing Cold in turn-based fights: { init: initiative lost, acts: moves lost this round } (tbfight.js rollOrder) */
  function numb(f) {
    if (!f || !(f._numb >= (f.turn || 0))) return { init: 0, acts: 0 };
    let acts = 0;
    if (!BIG(f) && (f._numbCd || 0) <= (f.turn || 0)) { acts = 1; f._numbCd = (f.turn || 0) + 3; }
    return { init: 8, acts };
  }

  /* once a turn (wraps PFX.tick): venom ticks, wildfire grows */
  if (typeof PFX !== "undefined" && PFX.tick) {
    const baseTick = PFX.tick;
    PFX.tick = function (f, line) {
      const extra = [];
      if (f._venom?.length && f.ehp > 0) {
        const d = f._venom.reduce((a, v) => a + v.dmg, 0); f.ehp -= d; extra.push(`\uE12E venom ${d}`);
        f._venom = f._venom.map((v) => ({ ...v, turns: v.turns - 1 })).filter((v) => v.turns > 0);
      }
      const b = f._wild && f.foeSt?.burn;
      if (b) { if (b.base == null) b.base = b.dmg; else b.dmg = Math.min(b.base * 2, Math.round(b.dmg * 1.25 + 0.5)); }
      if (extra.length) line.me += " · " + extra.join(" · ");
      return baseTick(f, line);
    };
  }

  /* ---- you get hit (wraps G.Fight.prototype.enemyTurn): venom-weakened blows, Last Ward, Mana Shield, Thorns */
  function hurt(f, loss) {
    const s = f.s; let txt = "", back = 0;
    const blow = loss;
    if (f._venom?.length) { const r = loss * 0.1; back += r; loss -= r; }
    if (f._lward > 0) { const soak = Math.min(f._lward, loss); f._lward -= soak; back += soak; loss -= soak; txt += ` · \uE102 Last Ward soaks ${Math.round(soak)}`; }
    const ms = Math.min(0.4, worn(s, "e2:manashield") / 100);
    if (ms > 0 && f.mp > 0 && loss > 0) { const take = Math.min(f.mp, loss * ms); f.mp -= take; back += take; loss -= take; if (take >= 1) txt += ` · ${Math.round(take)} taken from your magicka`; }
    f.hp += back;
    const mh = typeof G !== "undefined" ? G.maxHealth(s) : 100;
    const lw = worn(s, "e2:lastward");
    if (lw > 0 && !f._lwardUsed && f.hp > 0 && f.hp < mh / 3) { f._lwardUsed = true; if (!stack(f, "me", "ward", lw)) f._lward = lw; txt += ` · \uE102 a Last Ward rises (${Math.round(lw)})`; }
    const th = Math.min(0.3, worn(s, "e2:thorns") / 100);
    const ranged = f.tags.has("mage") || /archer|bow|hunter|marksman|ranger|sniper|mage|wizard|conjurer|necromancer|sorcer|witch|warlock/i.test(name(f)) || !!f.fp?.caster;
    if (th > 0 && f.ehp > 0 && !ranged && blow > 0) { const d = Math.max(1, Math.round(blow * th)); f.ehp -= d; txt += ` · thorns ${d}`; }
    return txt;
  }
  if (typeof G !== "undefined" && G.Fight) {
    const FP = G.Fight.prototype, baseTurn = FP.enemyTurn, baseApply = FP.apply;
    FP.enemyTurn = function (...a) {
      const hp0 = this.hp;
      let out = baseTurn.apply(this, a);
      try { const loss = hp0 - this.hp; if (loss > 0 && this.s) out += hurt(this, loss); } catch (e) { /* never break a fight */ }
      return out;
    };
    FP.apply = function (...a) {   // Fortune: the fallen foe's purse is fuller (gold is rolled right after this)
      try {
        const k = this.won && this.e && !this.e._fortune && Array.isArray(this.e.gold) ? worn(this.s, "e2:gold") : 0;
        if (k > 0) { this.e.gold = this.e.gold.map((g) => Math.round(g * (1 + k / 100))); this.e._fortune = true; }
      } catch (e) { /* gold as usual */ }
      return baseApply.apply(this, a);
    };
  }

  /* party fights: what our effects left on the foe travels with it to every phone (sharedfight.js) */
  if (typeof TB !== "undefined" && Array.isArray(TB.FOE_KEYS)) for (const k of ["_numb", "_numbCd", "_venom", "_sunder", "_wild", "_thunderCd", "_silenceCd"]) if (!TB.FOE_KEYS.includes(k)) TB.FOE_KEYS.push(k);

  /* glows on the fight screen (combatfx.js) */
  if (typeof COMBATFX !== "undefined" && COMBATFX.GLOW) Object.assign(COMBATFX.GLOW, {
    chain_lightning: ["#9a8aff", "#e0d8ff", "#ffffff"], bloodthirst: ["#c0102a", "#ff6a7a"], numbing: ["#a8e8ff", "#ffffff"], wildfire: ["#ff5a1a", "#ffd24a", "#fff2c0"],
    dragonbane: ["#ffcf6a", "#fff0c0"], banishing: ["#e0d0ff", "#a07aff"], thunderclap: ["#c8c0ff", "#ffffff"], reaping: ["#9aa0a8", "#e8e8f0"],
    sundering: ["#d08a4a", "#ffd0a0"], spellbreaker: ["#6aa8ff", "#ffffff"], echo: ["#b0f0ff", "#ffffff"], venom: ["#7aff3a", "#d0ff9a"],
  });

  return { stack, WEAPON, ARMOR, PFXMAP, FOUND_W, FOUND_A, UNIQUES, STRONG, isNew, hit, numb, hurt, isDaedra, isCaster, living };
})();
