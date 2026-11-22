/* [OURS] Humanoid foes get perks from the real perk trees (perks.js + perkfx.js), like a player of their level would.
   Bandits, soldiers, mages, necromancers, assassins, draugr and dremora pick perks by archetype; beasts, dragons,
   atronachs and other creatures get none. FOEPERKS.build(foe) is deterministic (same foe, same perks) and is cached
   on the foe as e.fp = { arch, perks:{id:rank}, list:[names], ...combat numbers }.
   The engine reads the numbers in Fight (enemyTurnInner for their blows, the player's hits for their defences). */
const FOEPERKS = (() => {
  const RATIO = 0.5;            // perk points = (level - 1) × RATIO   (players get level - 1)
  const MAX_POINTS = 40;
  const hash = (str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  /* who counts as a humanoid fighter */
  const NOT = /wolf|bear|sabre|cat|troll|spider|skeever|mudcrab|horker|mammoth|giant|dragon|atronach|wisp|wraith|spriggan|chaurus|netch|hopper|lurker|seeker|centurion|sphere|dwarven spider|horse|elk|deer|goat|slaughterfish|dog|fox|rabbit|bird|ghost|skeleton|spawn|riekling/i;
  const YES = /bandit|outlaw|thug|marauder|highwayman|forsworn|briarheart|thalmor|justiciar|necromancer|mage|wizard|sorcer|warlock|witch|hagraven|vampire|draugr|dremora|falmer|soldier|legionnaire|stormcloak|imperial|guard|silver hand|assassin|brotherhood|thief|cutpurse|vigilant|cultist|priest|mercenary|hunter|archer|knight|warrior|duelist|champion|miraak|chief|warlord|berserker|bounty|fanatic|zealot|smuggler|pirate|bosmer|orc|nord|reaver|whiterun|captain|lord|ranger|apostle|acolyte|adept|apprentice|conjurer|pyromancer|cryomancer|electromancer|enchanter/i;
  function humanoid(e) {
    if (!e || e.kind === "event") return false;
    const n = e.name || "", tags = new Set(e.tags || []);
    if (tags.has("beast") || tags.has("dragon") || tags.has("creature") || tags.has("machine") || tags.has("daedra") && !/dremora/i.test(n)) return false;
    if (NOT.test(n) && !/dremora|draugr/i.test(n)) return false;
    return tags.has("humanoid") || YES.test(n);
  }

  /* archetype from name and tags */
  function archetype(e) {
    const n = e.name || "", h = hash(n);
    if (/archer|hunter|marksman|bow|ranger|scout|sniper/i.test(n)) return "archer";
    if (/assassin|brotherhood|thief|cutpurse|nightingale|shadow|stalker|smuggler/i.test(n)) return "assassin";
    if (/necromancer|vampire|bonecaller|lich|conjurer|warlock/i.test(n)) return "necro";
    if (/healer|vigilant|acolyte|priest of|monk/i.test(n)) return "healer";
    if (/fire|pyro|flame|ember/i.test(n)) return "mage_fire";
    if (/frost|ice|cryo|snow/i.test(n)) return "mage_frost";
    if (/storm|shock|spark|lightning|electro/i.test(n)) return "mage_shock";
    if (/mage|wizard|sorcer|thalmor|justiciar|witch|hagraven|cultist|apostle|adept|apprentice|miraak|enchanter/i.test(n) || (e.tags || []).includes("mage"))
      return ["mage_fire", "mage_frost", "mage_shock"][h % 3];
    if (/chief|berserk|marauder|warlord|reaver|deathlord|scourge|overlord|dremora|orc|barbarian|champion/i.test(n)) return "twohand";
    if (/draugr/i.test(n)) return h % 2 ? "twohand" : "warrior";
    return h % 4 === 0 ? "twohand" : "warrior";
  }

  /* priority lists: perk ids in the order this kind of fighter would take them (repeats = more ranks) */
  const R = (id, n) => Array(n).fill(id);
  const ARCH = {
    warrior: { name: "Warrior", trees: ["One-Handed", "Blocking", "Heavy Armor"], list: ["armsman", "shield_wall", "juggernaut", "armsman", "fighting_stance", "bladesman", "well_fitted", "armsman", "shield_wall", "juggernaut", "savage_strike", "power_bash", "critical_charge", "bladesman", "juggernaut", "armsman", "conditioning", "shield_wall", "elemental_protection", "deflect_arrows", "bladesman", "armsman", "juggernaut", "fortress", "shield_wall", "paralyzing_strike", "reflect_blows", "duelist"] },
    twohand: { name: "Two-hander", trees: ["Two-Handed", "Heavy Armor"], list: ["barbarian", "juggernaut", "barbarian", "champions_stance", "deep_wounds", "well_fitted", "barbarian", "devastating_blow", "limbsplitter", "juggernaut", "brute_force", "great_critical_charge", "barbarian", "skullcrusher", "juggernaut", "deep_wounds", "conditioning", "sweep", "barbarian", "unstoppable", "juggernaut", "fortress", "deep_wounds", "warmaster", "reflect_blows"] },
    archer: { name: "Archer", trees: ["Archery", "Light Armor", "Sneak"], list: ["overdraw", "agile_defender", "overdraw", "eagle_eye", "critical_shot", "stealth", "overdraw", "custom_fit", "steady_hand", "power_shot", "agile_defender", "critical_shot", "hunters_discipline", "overdraw", "backstab", "deadly_aim", "quick_shot", "ranger", "critical_shot", "agile_defender", "steady_hand", "unhindered", "marksman", "bullseye", "wind_walker"] },
    assassin: { name: "Assassin", trees: ["Sneak", "One-Handed", "Light Armor"], list: ["stealth", "armsman", "backstab", "agile_defender", "stealth", "deadly_aim", "armsman", "custom_fit", "assassins_blade", "fighting_stance", "stealth", "muffled_movement", "light_foot", "armsman", "bladesman", "agile_defender", "shadow_dancer", "savage_strike", "silent_roll", "critical_charge", "assassins_mark", "unhindered", "shadow_warrior", "riposte", "vanish"] },
    mage_fire: { name: "Fire mage", trees: ["Destruction", "Alteration", "Restoration"], el: "fire", list: ["novice_destruction", "augmented_flames", "destruction_dual_casting", "novice_alteration", "apprentice_destruction", "augmented_flames", "mage_armor", "impact", "magic_resistance", "intense_flames", "adept_destruction", "novice_restoration", "regeneration", "mage_armor", "rune_master", "magic_resistance", "expert_destruction", "ward_absorb", "respite", "mage_armor", "magic_resistance", "master_destruction", "atronach", "elemental_skin"] },
    mage_frost: { name: "Frost mage", trees: ["Destruction", "Alteration", "Restoration"], el: "frost", list: ["novice_destruction", "augmented_frost", "destruction_dual_casting", "novice_alteration", "apprentice_destruction", "augmented_frost", "mage_armor", "impact", "magic_resistance", "deep_freeze", "adept_destruction", "novice_restoration", "regeneration", "mage_armor", "rune_master", "magic_resistance", "expert_destruction", "ward_absorb", "respite", "mage_armor", "magic_resistance", "master_destruction", "atronach", "elemental_skin"] },
    mage_shock: { name: "Storm mage", trees: ["Destruction", "Alteration", "Restoration"], el: "shock", list: ["novice_destruction", "augmented_shock", "destruction_dual_casting", "novice_alteration", "apprentice_destruction", "augmented_shock", "mage_armor", "impact", "magic_resistance", "disintegrate", "adept_destruction", "novice_restoration", "regeneration", "mage_armor", "rune_master", "magic_resistance", "expert_destruction", "ward_absorb", "respite", "mage_armor", "magic_resistance", "master_destruction", "atronach", "elemental_skin"] },
    necro: { name: "Necromancer", trees: ["Conjuration", "Destruction", "Alteration"], el: "frost", list: ["novice_conjuration", "necromancy", "novice_destruction", "summoner", "apprentice_conjuration", "augmented_frost", "novice_alteration", "mage_armor", "summoner", "dark_souls", "adept_conjuration", "soul_stealer", "destruction_dual_casting", "apprentice_destruction", "atromancy", "mage_armor", "magic_resistance", "expert_conjuration", "elemental_potency", "augmented_frost", "mage_armor", "master_conjuration", "twin_souls"] },
    healer: { name: "Battle healer", trees: ["Restoration", "One-Handed", "Heavy Armor"], el: "sun", list: ["novice_restoration", "armsman", "regeneration", "juggernaut", "recovery", "restoration_dual_casting", "apprentice_restoration", "armsman", "respite", "well_fitted", "recovery", "juggernaut", "necromage", "adept_restoration", "ward_absorb", "armsman", "fighting_stance", "expert_restoration", "juggernaut", "avoid_death", "master_restoration"] },
  };

  /* combat numbers per perk: d = their damage, t = damage they take (negative = less), s = their spell power,
     c = crit chance, b = block chance, p = power-attack chance, o = ambush opener ×, h = self-heal chance,
     dc = dual-cast chance, st = elemental status chance bonus, w = ward vs your spells, ad = avoid death */
  const FX = {
    armsman: { d: 0.10 }, barbarian: { d: 0.10 }, overdraw: { d: 0.10 }, stealth: { o: 0.1 },
    bladesman: { c: 0.05 }, deep_wounds: { c: 0.05 }, critical_shot: { c: 0.05 }, bone_breaker: { d: 0.04 }, skullcrusher: { d: 0.04 },
    hack_and_slash: { bl: 2 }, limbsplitter: { bl: 2 },
    fighting_stance: { p: 0.06 }, champions_stance: { p: 0.06 }, savage_strike: { p: 0.06, pd: 0.1 }, devastating_blow: { p: 0.06, pd: 0.15 },
    power_shot: { p: 0.08, stg: 0.25 }, paralyzing_strike: { par: 0.1 }, warmaster: { pd: 0.1 }, brute_force: { d: 0.05 },
    critical_charge: { o: 0.25 }, great_critical_charge: { o: 0.25 }, sweep: { d: 0.05 }, unstoppable: { t: -0.03 },
    dual_flurry: { d: 0.04 }, dual_savagery: { d: 0.04 }, duelist: { d: 0.05, c: 0.03 },
    eagle_eye: { hit: 0.03 }, steady_hand: { d: 0.04 }, quick_shot: { d: 0.06 }, bullseye: { par: 0.08 }, hunters_discipline: { d: 0.03 }, ranger: { d: 0.03 }, marksman: { hit: 0.04 },
    shield_wall: { b: 0.03 }, quick_reflexes: { b: 0.03 }, power_bash: { stg: 0.15 }, deadly_bash: { d: 0.03 }, elemental_protection: { w: 0.15 }, deflect_arrows: { arrows: 0.4 },
    block_runner: { b: 0.02 }, disarming_bash: { stg: 0.05 }, shield_charge: { o: 0.2 }, guardian: { b: 0.03 },
    juggernaut: { t: -0.04 }, well_fitted: { t: -0.05 }, conditioning: { t: -0.03 }, reflect_blows: { refl: 0.08 }, fists_of_steel: { d: 0.02 }, cushioned: { t: -0.02 }, unbowed: { t: -0.03 }, tower_of_strength: { t: -0.03 }, fortress: { t: -0.05 },
    agile_defender: { t: -0.03 }, custom_fit: { t: -0.04 }, unhindered: { dodge: 0.03 }, wind_walker: { t: -0.02 }, deft_movement: { dodge: 0.08 }, light_step: { dodge: 0.02 }, fleet_foot: { dodge: 0.03 }, riposte: { d: 0.03 }, ward_weave: { w: 0.08 },
    backstab: { o: 0.4 }, deadly_aim: { o: 0.4 }, assassins_blade: { o: 0.8 }, muffled_movement: { o: 0.1 }, light_foot: { dodge: 0.02 }, silent_roll: { dodge: 0.03 }, silence: { o: 0.1 }, shadow_dancer: { dodge: 0.04 }, assassins_mark: { c: 0.05 }, shadow_warrior: { dodge: 0.04 }, vanish: { dodge: 0.03 },
    novice_destruction: { s: 0.06 }, apprentice_destruction: { s: 0.06 }, adept_destruction: { s: 0.06 }, expert_destruction: { s: 0.06 }, master_destruction: { s: 0.08 },
    augmented_flames: { s: 0.10 }, augmented_frost: { s: 0.10 }, augmented_shock: { s: 0.10 }, impact: { stg: 0.12 }, rune_master: { s: 0.04 },
    intense_flames: { st: 0.2 }, deep_freeze: { st: 0.2 }, disintegrate: { st: 0.2 }, destruction_dual_casting: { dc: 0.2 },
    novice_restoration: { h: 0.12 }, apprentice_restoration: { h: 0.05 }, adept_restoration: { h: 0.05 }, expert_restoration: { h: 0.04 }, master_restoration: { h: 0.04 },
    regeneration: { hp: 0.25 }, recovery: { s: 0.02 }, respite: { h: 0.03 }, necromage: { s: 0.04 }, ward_absorb: { w: 0.12 }, avoid_death: { ad: 0.25 }, restoration_dual_casting: { hp: 0.15 },
    novice_conjuration: { sum: 0.06 }, apprentice_conjuration: { sum: 0.05 }, adept_conjuration: { sum: 0.05 }, expert_conjuration: { sum: 0.05 }, master_conjuration: { sum: 0.06 },
    summoner: { sum: 0.03 }, elemental_potency: { sum: 0.06 }, twin_souls: { sum: 0.1 }, atromancy: { sum: 0.02 }, necromancy: { sum: 0.05 }, dark_souls: { sum: 0.06 }, soul_stealer: { s: 0.02 },
    novice_alteration: { t: -0.02 }, apprentice_alteration: { t: -0.02 }, adept_alteration: { t: -0.02 }, mage_armor: { t: -0.04 }, magic_resistance: { w: 0.06 }, expert_alteration: { t: -0.02 }, master_alteration: { t: -0.03 },
    stability: { t: -0.02 }, atronach: { w: 0.12 }, alteration_dual_casting: { t: -0.02 }, elemental_skin: { w: 0.08 },
  };

  const treeOf = {}, def = {};
  function index() {
    if (Object.keys(def).length || typeof PERKS === "undefined") return;
    for (const [tree, ps] of Object.entries(PERKS.TREES)) for (const p of ps) { treeOf[p[0]] = tree; def[p[0]] = p; }
  }
  /* a foe's skill in the trees it trains: grows with level like a player who focuses on them */
  const skillFor = (lv, i) => Math.min(100, Math.round((i === 0 ? 20 : 15) + lv * (i === 0 ? 2.4 : i === 1 ? 2 : 1.6)));

  function build(e) {
    if (!e) return null;
    if (e.fp !== undefined) return e.fp;
    index();
    if (!humanoid(e) || typeof PERKS === "undefined") { e.fp = null; return null; }
    const arch = archetype(e), A = ARCH[arch];
    const lv = Math.max(1, e.plevel ?? e.level ?? 1), boss = (e.tags || []).includes("elite") || !!e.priest || !!e.rec;
    const pts = Math.min(MAX_POINTS, Math.floor((lv - 1) * RATIO * (boss ? 1.25 : 1)));
    const perks = {};
    const sk = {}; A.trees.forEach((t, i) => (sk[t] = skillFor(lv, i)));
    let left = pts;
    for (const id of A.list) {
      if (left <= 0) break;
      const p = def[id]; if (!p) continue;
      const [, , max, req, pre] = p, r = perks[id] || 0;
      if (r >= max) continue;
      if ((sk[treeOf[id]] ?? 0) < (req[r] ?? 999)) continue;
      if (pre.length && !pre.some((q) => perks[q])) continue;
      perks[id] = r + 1; left--;
    }
    // combat numbers
    const n = { d: 0, t: 0, s: 0, c: 0, b: 0, p: 0, pd: 0, o: 0, h: 0, hp: 0, dc: 0, st: 0, w: 0, ad: 0, bl: 0, stg: 0, par: 0, refl: 0, dodge: 0, hit: 0, sum: 0, arrows: 0 };
    for (const [id, r] of Object.entries(perks)) {
      const f = FX[id];
      if (f) for (const [k, v] of Object.entries(f)) n[k] += v * r;
      else n.d += 0.015 * r;   // any other combat perk: a little more bite
    }
    const fp = {
      arch, archName: A.name, el: A.el || null, points: pts, perks,
      list: Object.keys(perks).sort((a, b) => (/^(novice|apprentice)_/.test(a) - /^(novice|apprentice)_/.test(b)) || (perks[b] - perks[a]) || A.list.indexOf(a) - A.list.indexOf(b)).map((id) => def[id][1] + (perks[id] > 1 ? ` ${perks[id]}` : "")),
      dmg: 1 + Math.min(1.2, n.d + n.sum), spell: (1 + Math.min(1.2, n.s)) * (1 + Math.min(0.5, n.sum)), taken: Math.max(0.6, 1 + n.t),
      crit: Math.min(0.3, n.c), block: Math.min(0.3, n.b), power: Math.min(0.35, n.p), powerX: 1.5 + n.pd,
      opener: n.o ? 1 + Math.min(2.5, n.o) : 1, heal: Math.min(0.4, n.h), healAmt: 0.15 * (1 + n.hp), dual: Math.min(0.35, n.dc),
      status: Math.min(0.4, n.st), ward: Math.min(0.45, n.w), avoid: n.ad, bleed: n.bl, stagger: Math.min(0.35, n.stg),
      paralyze: Math.min(0.15, n.par), reflect: Math.min(0.12, n.refl), dodge: Math.min(0.15, n.dodge), hit: n.hit, arrows: Math.min(0.5, n.arrows),
    };
    fp.caster = /^mage|necro|healer/.test(arch);
    if (fp.caster && !e.element && ['fire', 'frost', 'shock'].includes(fp.el) && pts > 0) e.element = fp.el;   // their spells carry their element (burn / chill / jolt)
    e.fp = fp;
    return fp;
  }

  /* the 1–3 names to show on encounter cards and at the top of the fight log */
  const notable = (fp, k = 3) => (fp && fp.list.length ? fp.list.slice(0, k) : []);
  const label = (e) => { const fp = build(e); return fp && fp.list.length ? `${fp.archName} · ${notable(fp).join(", ")}${fp.list.length > 3 ? ` +${fp.list.length - 3}` : ""}` : ""; };
  const ELCLS = { fire: "el-fire", frost: "el-frost", shock: "el-shock", sun: "el-heal" };
  const html = (e, esc = (x) => x) => {
    const fp = build(e); if (!fp || !fp.list.length) return "";
    return `<p class="foeperks ${ELCLS[fp.el] || ""}"><b>${esc(fp.archName)}</b> · ${notable(fp).map((p) => `<span>${esc(p)}</span>`).join(", ")}${fp.list.length > 3 ? ` <small>+${fp.list.length - 3} perks</small>` : ""}</p>`;
  };

  /* expected damage multiplier of a foe's blows from its perks (Smart AI) */
  const expect = (e) => { const fp = build(e); if (!fp) return 1; const m = fp.caster ? fp.spell * (1 + fp.dual * 1.2) : fp.dmg; return m * (1 + fp.crit * 0.5) * (1 + fp.power * (fp.powerX - 1)) * (1 + 0.02 * fp.bleed); };

  return { build, humanoid, archetype, label, html, notable, expect, ARCH, FX, RATIO };
})();
if (typeof module !== "undefined") module.exports = FOEPERKS;
