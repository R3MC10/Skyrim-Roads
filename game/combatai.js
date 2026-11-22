/* Smart combat AI ([OURS]). Instead of a rule list, each turn the fighter looks at everything it can do right now
   (swing, power attack, block, every spell it knows, dual casts, shouts and powers, potions, scrolls), guesses what
   each one is worth this turn, and does the best one. One step ahead, no dice rolled: the same fight state always
   picks the same move, so arena duels stay identical on both phones.

   The yardstick is "turns": a fight is a race. You need Tk turns to kill the foe and it needs Td turns to kill you.
   Damage brings Tk down, healing and protection push Td up. Damage is worth damage ÷ your best damage per turn.
   Healing is worth health ÷ the foe's damage per turn, but only counts when the race is close (so no idle healing
   and no heal loops: a heal smaller than one enemy hit is worth less than a swing). Magicka matters when your best
   move is a spell and the fight will outlast your magicka. Potions, scrolls, shouts and daily powers carry a "keep
   it for later" cost that drops in dangerous fights.

   Loadouts carry mode: "smart" (default) or "custom" (the old rule list). Rules are never deleted, so switching
   back to Custom restores them. */
const COMBATAI = (() => {
  const isSmart = (L) => !L || L.mode !== "custom";
  const avgSpread = () => (F.DAMAGE_SPREAD[0] + F.DAMAGE_SPREAD[1]) / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hasM = () => typeof MAGIC !== "undefined";
  const hasPw = (f) => typeof POWERS !== "undefined" && f.pw;

  // ---- what the foe does to you, per turn, on average
  function incoming(f, now = false) {
    const s = f.s, e = f.e;
    if (now && (f.calmTurns > 0 || f.eParalyzed > 0 || f.stagger || f.fearTurns > 0 || f.unseen > 0)) return 0;
    const { rating, pieces } = f.armorRating();
    const magic = f.tags.has("mage") || f.tags.has("dragon");
    let d = (e.damage || 0) * F.HIT_CHANCE * (now && f.slowed ? 0.5 : 1) * (1 - F.damageReduction(rating, pieces));
    if (magic) d *= (1 - 0.1 * G.P(s, "magic_resistance")) * (1 - Math.min(0.5, G.fxSum(s, "resist") / 100));
    if (hasPw(f)) d = POWERS.dmgIn(f, d, magic);
    if (typeof PFX !== "undefined") { d *= PFX.inMult(f, { hit: d }) * (1 - Math.min(0.3, PFX.sum(s, "dodge", f, {}))); const fe = PFX.foeElement(e); if (fe && f.meSt?.burn) d += f.meSt.burn.dmg; }   // armor/style perks; you're already burning
    const n = f.allies.length; if (n) d *= 1 - n / (n + 1) * 0.7 * F.HIT_CHANCE;   // allies soak some blows
    if (f.ward && hasM() && MAGIC.isCaster(f)) d = Math.max(0, d - f.ward / 3);
    if (e.priest) d *= 1.3;   // dragon priests also cast
    if (typeof FOEPERKS !== "undefined") d *= FOEPERKS.expect(e);   // their perks: power attacks, crits, dual casts
    return Math.max(0.01, d);
  }
  // ---- your weapon swing, on average
  function sneakReady(f) { return (f.turn === 1 && f.hidden) || f.sneakNext; }
  function swing(f, power) {
    const s = f.s;
    if (f.weapon?.staff && !f.bound) {   // a staff casts its spell
      const st = f.weapon.staff, row = G.invRow(s, f.weaponInv), sp = D.SPELLS[st.spell];
      const charge = f.charges[f.weaponInv] ?? row?.charge ?? 0;
      if (!sp || charge < st.perCast) return 3;
      return spellDamage(f, sp, st.spell, false, true) || 6;
    }
    let base;
    if (!f.weapon && !f.bound) { const [a, b] = F.unarmedRange(G.skill(s, "Hand-to-Hand"), s.race); base = (a + b) / 2 + 4 * G.P(s, "iron_fists"); }
    else base = f.weaponDamage();
    let d = base * avgSpread() * (power ? F.POWER_ATTACK_DAMAGE : 1);
    const sk = f.weaponSkill();
    if (power && ((sk === "One-Handed" && G.P(s, "savage_strike")) || (sk === "Two-Handed" && G.P(s, "devastating_blow")))) d *= 1.25;
    let hit = F.HIT_CHANCE;
    if (f.wx && f.weapon && f.ammoKind && f.ammoKind()) hit *= f.wx.aim;   // fog, blizzards and storms spoil your aim
    if (sneakReady(f)) {
      const wt = f.wt, m = wt === "dagger" && G.P(s, "assassins_blade") ? 15 : sk === "One-Handed" && G.P(s, "backstab") ? 6 : sk === "Archery" && G.P(s, "deadly_aim") ? 3 : F.sneakMultiplier(sk);
      d *= m; hit = 1;
    }
    if (f.mount?.up) d *= 1.05;
    if (typeof PFX !== "undefined") {   // the bigger perk trees: first strikes, dual flurry, sneak bonuses, quick second strikes, a surer aim
      const x = { power, sneak: sneakReady(f), sk, wt: f.wt };
      d *= PFX.out(f, x) * (1 + 0.5 * Math.min(0.5, PFX.sum(s, "extra", f, x))) * (f.riposte ? 1.5 : 1);
      if (hit < 1) hit = Math.min(0.98, hit + PFX.sum(s, "hit", f, x)); if (PFX.has(s, "sure", f, x)) hit = 1;
    }
    const [cc, cm] = f.critChance(); if (cc) d += cc * (f.weapon ? f.weapon.damage : 0) * cm;
    if (hasPw(f)) d *= POWERS.dmgOut(f);
    if (f.e.red) d *= 1 - f.e.red;
    if (f.weapon?.enchant) { const row = G.invRow(s, f.weaponInv); const ch = f.charges[f.weaponInv] ?? row?.charge ?? 0; if (ch > 0) d += f.weapon.enchant.magnitude || 0; }
    if (f.weapon && f.ammoKind && f.ammoKind() && !f.ammoRow()) d = Math.min(d, 3);
    return d * hit;
  }
  // ---- a damage spell, on average (0 if it can't hurt this foe)
  function spellDamage(f, sp, id, dual, free) {
    const s = f.s;
    if (sp.kind !== "damage") return 0;
    if (sp.element === "sun" && !f.tags.has("undead")) return 0;
    const aug = { fire: G.P(s, "augmented_flames"), frost: G.P(s, "augmented_frost"), shock: G.P(s, "augmented_shock") }[sp.element] || 0;
    let a = (sp.amount || 0) * (dual && hasM() ? MAGIC.DUAL_POWER : 1) * (1 + 0.25 * aug) * (1 + G.fxSum(s, "spell:" + sp.school) / 100)
      * (f.tags.has("undead") && G.P(s, "necromage") ? 1.25 : 1) * (hasM() && sp.element !== "sun" ? MAGIC.elem(f, sp.element) : 1);
    if (typeof WFX !== "undefined") a *= WFX.elem(f, sp.element) * (f.wx && f.wx.storm && sp.element === "shock" ? 1.1 : 1);   // the weather: rain dulls fire, storms feed shock
    if (f.turn === 1 && f.hidden && G.P(s, "quiet_casting")) a *= 2;
    const fail = !free && hasM() && id ? MAGIC.failChance(s, id) : 0;
    if (typeof PFX !== "undefined" && sp.element) a += PFX.statusValue(f, sp.element, a);   // a foe already burning to death isn't worth more fire; Disintegrate near the end
    return a * F.SPELL_HIT_CHANCE * (1 - fail);
  }
  const spellCost = (f, id, dual) => G.spellCost(f.s, D.SPELLS[id]) * (dual && hasM() ? MAGIC.DUAL_COST : 1);

  // ---- every move you could make now
  function options(f) {
    const s = f.s, out = ["attack", "power_attack", "block"];
    for (const id of s.spells || []) { const sp = D.SPELLS[id]; if (!sp || sp.kind === "utility") continue; out.push("spell:" + id); if (hasM() && MAGIC.dualable(sp)) out.push("dual:" + id); }
    for (const r of ["health", "magicka", "stamina"]) out.push("potion:" + r);
    const scrolls = new Set(); for (const r of s.inv) { const it = D.ITEMS[r.item]; if (it?.slot === "scroll" && it.spell && D.SPELLS[it.spell]) scrolls.add(r.item); }
    for (const it of scrolls) out.push("scroll:" + it);
    if (hasPw(f)) {
      out.push("power:race", "power:stone"); if (typeof CURSE !== "undefined") out.push("power:beast", "power:lord");
      for (const id of Object.keys(POWERS.SHOUTS)) if (!POWERS.ROAD_SHOUTS.includes(id) && POWERS.level(s, id) > 0) out.push("shout:" + id);
    }
    return out.filter((a) => { try { return f.affordable(a); } catch { return false; } });
  }

  // ---- how the fight looks right now
  function picture(f) {
    const s = f.s, mh = G.maxHealth(s);
    const inc = incoming(f), incNow = incoming(f, true);
    // your best repeatable damage per turn
    let best = swing(f, false), bestSpell = null;
    const pa = f.sp >= f.paCost ? swing(f, true) : 0;
    const paSustain = f.paCost > 0 ? Math.min(1, (f.regenSp + 1e-9) / f.paCost) : 1;   // how often you can keep power attacking
    best = Math.max(best, best * (1 - paSustain) + (pa || swing(f, true)) * paSustain * (f.sp >= f.paCost ? 1 : 0.5));
    for (const id of s.spells || []) {
      const sp = D.SPELLS[id]; if (!sp || sp.kind !== "damage") continue;
      const d = spellDamage(f, sp, id), c = spellCost(f, id);
      if (d > 0 && f.mp >= c) { const per = d; if (per > best) { best = per; bestSpell = { id, d, c }; } }
    }
    const dps = Math.max(1, best + summonPer(f) + allyPer(f) + dotPer(f));
    const Tk = Math.max(0.5, f.ehp / dps), Td = Math.max(0.1, f.hp / inc);
    return { s, mh, inc, incNow, dps, Tk, Td, margin: Td - Tk, bestSpell, missing: mh - f.hp };
  }
  const summonPer = (f) => (f.summonTurns > 0 ? f.summonDmg : 0);
  const allyPer = (f) => f.allies.reduce((a, x) => a + (x.down ? 0 : x.dmg || 0), 0) * avgSpread();
  const dotPer = (f) => (f.cloak ? f.cloak.dmg : 0) + (f.dots || []).reduce((a, x) => a + x.dmg, 0) + (f.pw?.cloak > 0 ? 8 : 0);
  // how much protection is worth: always something (health carries into the next fight), a lot when the race is close
  const wDef = (p) => (p.margin < 1 ? 1.1 : p.margin < 3 ? 0.7 : p.margin < 6 ? 0.4 : 0.25);
  const wHeal = (p) => (p.margin < 0.5 ? 1.15 : p.margin < 1.5 ? 0.9 : p.margin < 3 ? 0.35 : 0.04);
  /* healing h: the part that keeps you alive until the foe falls counts fully; the rest only a little
     (you can patch up after the fight) */
  function healV(f, p, h) {
    h = Math.max(0, Math.min(h, p.missing));
    const need = Math.max(0, p.inc * (p.Tk + 1) * 1.25 - f.hp), save = Math.min(h, need);
    return (save / p.inc) * (p.margin < 0.5 ? 1.15 : 1) + ((h - save) / p.inc) * 0.06;
  }
  const tough = (f) => !!(f.e.boss || f.e.priest || f.tags.has("dragon") || f.tags.has("elite") || f.e.danger === "high");

  // ---- value of one move, in turns of advantage
  function value(f, p, a) {
    const s = f.s, [kind, arg] = a.split(":");
    const dmgV = (d, p2 = p) => {   // damage done now; a blow that ends the fight is worth the whole rest of the race
      const dd = Math.min(d, f.ehp); let v = dd / p2.dps;
      const pk = d >= f.ehp ? 0.88 : d * 1.25 >= f.ehp ? 0.45 : 0;
      if (pk) v += pk * Math.max(p2.incNow / p2.inc, 0.3) * wDef(p2) * (1 + 2 / Math.max(0.5, p2.Td));
      return v; };
    const remT = Math.max(1, p.Tk);
    if (a === "attack") return { v: dmgV(swing(f, false)), why: "" };
    if (a === "power_attack") {
      const d = swing(f, true), stag = F.STAGGER_CHANCE * wDef(p);
      // keep enough stamina for later power attacks only matters a little: a turn of plain swing is the fallback
      return { v: dmgV(d) + stag - (f.sp - f.paCost < f.paCost ? 0.02 : 0), why: d >= f.ehp ? "finishing blow" : "" };
    }
    if (a === "block") {
      const shieldBase = f.shield ? f.shield.armor : (f.wt === "spear" && G.P(s, "phalanx") ? 20 : null);
      let pct = F.blockPercent(G.skill(s, "Blocking"), shieldBase, f.tags.has("humanoid") ? f.e.damage : 0);
      pct = Math.min(0.85, pct * (1 + 0.05 * G.P(s, "shield_wall")));
      const bash = G.P(s, "power_bash") ? 0.3 * (1 + (G.P(s, "deadly_bash") ? 0.3 : 0)) : 0;
      return { v: (pct * p.incNow / p.inc) * wDef(p) + bash * wDef(p) * 0.8 - 0.05, why: "guards against a big hit" };
    }
    if (kind === "potion") {
      const r = f.findPotion(arg), amt = r ? D.ITEMS[r.item].restore[1] : 0, keep = typeof FAVWHEEL !== "undefined" && FAVWHEEL.potFree(f, a) ? 0 : tough(f) ? 0.15 : 0.45;   // a queued favourite potion isn't saved
      if (arg === "health") return { v: healV(f, p, amt) - keep, why: "badly hurt" };
      if (arg === "magicka") {
        const bs = bestCastable(f, true); if (!bs) return { v: -1 };
        if (f.mp >= bs.c) return { v: -1 };
        const casts = Math.min(Math.floor((f.mp + amt) / bs.c), Math.ceil(remT));
        return { v: casts * Math.max(0, bs.d - swing(f, false)) / p.dps - 1 - keep, why: "out of magicka" };
      }
      return { v: -1 };
    }
    if (kind === "shout" || kind === "power") return pwValue(f, p, kind, arg, dmgV, remT);
    let id = arg, free = false, dual = kind === "dual", keep = 0;
    if (kind === "scroll") { id = D.ITEMS[arg].spell; free = true; keep = tough(f) ? 0.15 : 0.5; }
    const sp = D.SPELLS[id]; if (!sp) return { v: -1 };
    const cost = free ? 0 : spellCost(f, id, dual);
    const fail = !free && hasM() ? MAGIC.failChance(s, id) : 0, ok = 1 - fail;
    const mpV = mpValue(f, p, cost) + keep;
    const amt = (sp.amount || 0) * (dual && hasM() ? MAGIC.DUAL_POWER : 1) * (1 + G.fxSum(s, "spell:" + sp.school) / 100);
    const el = sp.element, em = el && hasM() ? MAGIC.elem(f, el) : 1;
    switch (sp.kind) {
      case "damage": { const d = spellDamage(f, sp, id, dual, free); return d > 0 ? { v: dmgV(d) - mpV, why: em > 1.1 ? `${el} hurts it most` : d >= f.ehp ? "finishing blow" : typeof WFX !== "undefined" && WFX.elem(f, el) > 1.05 ? `the ${f.wx.name.toLowerCase()} feeds ${el}` : "" } : { v: -1 }; }
      case "heal": {
        return { v: healV(f, p, amt * (G.P(s, "regeneration") ? 1.5 : 1)) * ok - mpV, why: p.margin < 1 ? "losing the race: heals" : "patches up" };
      }
      case "regen": { if (f.regen) return { v: -1 }; return { v: healV(f, { ...p, missing: p.missing + amt * remT * 0.5 }, amt * Math.min(sp.turns || 1, remT + 1)) * 0.9 * ok - mpV, why: "a long fight: healing circle" }; }
      case "armor": {
        const bare = !Object.values(f.armor).some((x) => ["light", "heavy", "medium"].includes(x.type));
        const m = bare && G.P(s, "mage_armor") ? [1, 2, 2.5, 3][G.P(s, "mage_armor")] : 1, newA = amt * m;
        if (newA <= f.armorSpell + 1) return { v: -1 };
        const { rating, pieces } = f.armorRating(), raw = (f.e.damage || 0) * F.HIT_CHANCE;
        const drop = (F.damageReduction(rating - f.armorSpell + newA, pieces) - F.damageReduction(rating, pieces)) * raw;
        return { v: (drop * Math.min(remT, 20) / p.inc) * wDef(p) * ok - mpV, why: "armors up for a long fight" };
      }
      case "ward": {
        if (!hasM() || !MAGIC.isCaster(f) || (f.ward || 0) > amt * 0.3) return { v: -1 };
        const soak = Math.min(amt, p.inc * Math.min(remT, 6) * 1.2);
        return { v: (soak / p.inc) * wDef(p) * ok * 0.8 - mpV, why: "a caster: raises a ward" };
      }
      case "summon": {
        if (f.summonTurns > 0) return { v: -1 };
        const dmg = (sp.amount || 0) * (G.P(s, "elemental_potency") ? 1.5 : 1) * (G.P(s, "twin_souls") ? 2 : 1), turns = (sp.turns || 3) + 2 * G.P(s, "summoner");
        return { v: (dmg * Math.min(turns, Math.max(0, remT - 1)) / p.dps) * 0.85 * ok - mpV, why: "a long fight: summons help" };
      }
      case "calm": {
        if ((f.tags.has("undead") || f.tags.has("construct")) && !G.P(s, "master_of_the_mind")) return { v: -1 };
        const cap = (sp.max_level || 0) + (f.tags.has("beast") && G.P(s, "animage") ? 8 : 0) + (f.tags.has("humanoid") && G.P(s, "kindred_mage") ? 8 : 0);
        if ((f.e.level ?? 99) > cap || f.calmTurns > 0) return { v: -1 };
        return { v: Math.min(sp.turns || 3, remT) * wDef(p) * ok - mpV, why: "calms it and strikes freely" };
      }
      case "paralyze": {
        if (f.tags.has("dragon") || f.eParalyzed > 0) return { v: -1 };
        return { v: (f.tags.has("elite") ? 0.6 : 0.9) * Math.min(Math.round(amt), remT + 1) * wDef(p) * 1.05 * ok - mpV, why: "paralyzes it" };
      }
      case "fear": {
        if (f.tags.has("undead") || f.tags.has("construct") || f.fearTurns > 0) return { v: -1 };
        if ((f.e.level ?? 1) > (sp.max_level || 0) + (G.P(s, "rage") ? 8 : 0)) return { v: -1 };
        return { v: Math.min(Math.round(sp.amount || 0), remT) * wDef(p) * ok - mpV, why: "scares it off for a while" };
      }
      case "turn": {
        if (!f.tags.has("undead") || f.e.boss || f.tags.has("elite") || (f.e.level ?? 1) > (sp.max_level || 0)) return { v: -1 };
        return { v: (remT + 1) * ok - mpV, why: "turns the undead" };
      }
      case "rune": { if (f.rune) return { v: -1 }; return { v: dmgV(amt * em) * 0.95 * ok - mpV, why: "" }; }
      case "cloak": { if (f.cloak) return { v: -1 }; return { v: (amt * em * Math.min(sp.turns || 1, remT)) / p.dps * 0.8 * ok - mpV, why: "a long fight: cloak" }; }
      case "dot": { const tot = amt * em * Math.min(sp.turns || 1, remT + 1); return { v: Math.min(tot, f.ehp) / p.dps * 0.85 * ok - mpV, why: "" }; }
      case "invisibility": { if (f.unseen > 0) return { v: -1 }; const sn = Math.max(0, swing({ __proto__: f, sneakNext: true }, false) - swing(f, false)); return { v: (2 * p.incNow / p.inc) * wDef(p) + sn / p.dps - 1 - mpV, why: "vanishes for a sneak attack" }; }
      case "courage": { if (f.braveHp) return { v: -1 }; const boost = (allyPer(f) + summonPer(f)) * (sp.amount || 0) / 100 * Math.min(remT, 8); return { v: boost / p.dps + healV(f, p, (sp.amount || 0) / 2) - mpV, why: "" }; }
      case "bound": {
        if (f.bound) return { v: -1 };
        const now = swing(f, false), bd = F.weaponDamage(sp.amount || 0, G.skill(s, sp.skill), sp.skill === "Archery") * avgSpread() * F.HIT_CHANCE;
        if (f.weapon && !f.weapon.staff && bd < (f.weapon.damage + f.temper)) return { v: -1 };
        return { v: Math.max(0, bd - now) * Math.min(remT, 10) / p.dps * 0.9 * ok - mpV, why: "conjures a better weapon" };
      }
      case "soultrap": {
        if (f.soulTrap || f.tags.has("construct") || p.margin < 3) return { v: -1 };
        const gem = s.inv.some((r) => /^soul_gem_(common|greater)_empty$/.test(r.item)); if (!gem || f.ehp < p.dps * 1.2) return { v: -1 };
        return { v: 0.6 - mpV, why: "an easy fight: traps its soul" };
      }
      case "absorb": {   // spellbook.js: damage that refills magicka
        const d = amt * (hasM() && MAGIC.isCaster(f) ? 1.3 : 1);
        return { v: dmgV(d) * ok + (Math.min(d * 0.6, G.maxMagicka(s) - f.mp) > 0 ? 0.15 : 0) - mpV, why: hasM() && MAGIC.isCaster(f) ? "drains the mage's magicka" : "" };
      }
      case "healally": case "allyward": case "allyarmor": case "allyimbue": case "allycourage": case "allyunseen": case "allyrescue": case "allythorns":
        return typeof SPELLBOOK !== "undefined" ? SPELLBOOK.aiValue(f, p, { ...sp, amount: amt }, ok, mpV) : { v: -1 };
      case "banish": {
        if (typeof SPELLBOOK === "undefined" || !SPELLBOOK.isDaedra(f) || f.e.boss || (f.e.level ?? 1) > (sp.max_level || 0)) return { v: -1 };
        return { v: (sp.command ? Math.min(6, remT) * wDef(p) : remT + 1) * ok - mpV, why: sp.command ? "turns the daedra" : "banishes the daedra" };
      }
      case "equilibrium": {
        const bs = p.bestSpell; if (!bs || f.mp >= bs.c || p.margin < 2.5 || f.hp < (sp.amount || 25) * 3) return { v: -1 };
        return { v: 0.3, why: "trades health for magicka" };
      }
      case "reanimate": {
        if (f.reanimate || s.thrall || p.margin < 3 || f.tags.has("undead") || f.tags.has("construct") || f.tags.has("dragon") || (f.e.level ?? 1) > (sp.amount || 0)) return { v: -1 };
        return { v: 0.55 - mpV, why: "an easy fight: it will rise for you" };
      }
    }
    return { v: -1 };
  }
  // magicka spent now is magicka you can't spend on your best spell later
  function mpValue(f, p, cost) {
    if (!cost) return 0;
    const bs = p.bestSpell; if (!bs) return cost * 0.0004;
    const turnsOfMp = (f.mp - cost + f.regenMp * p.Tk) / bs.c;
    return turnsOfMp < p.Tk ? (cost / bs.c) * Math.max(0, bs.d - swing(f, false)) / p.dps : cost * 0.0004;
  }
  function bestCastable(f, ignoreMp) {
    let best = null;
    for (const id of f.s.spells || []) { const sp = D.SPELLS[id]; if (!sp || sp.kind !== "damage") continue; const d = spellDamage(f, sp, id), c = spellCost(f, id); if (d > 0 && (ignoreMp || f.mp >= c) && (!best || d > best.d)) best = { id, d, c }; }
    return best;
  }
  // shouts and once-a-day powers: worth saving unless the fight is dangerous
  function pwValue(f, p, kind, arg, dmgV, remT) {
    const s = f.s, danger = tough(f) || p.margin < 2;
    const lv = kind === "shout" ? POWERS.level(s, arg) : 0;
    const keep = kind === "shout" ? (danger ? 0.1 : clamp((POWERS.SHOUTS[arg][2][lv - 1] || 30) / 60, 0.4, 2.5)) : (danger ? 0.25 : 2.5);
    const d = wDef(p), stun = (k) => Math.min(k, remT + 1) * d;
    let v = -1, why = danger ? "a dangerous fight" : "";
    if (kind === "shout") switch (arg) {
      case "unrelenting_force": v = (f.eParalyzed > 0 ? 0 : stun(lv)) + dmgV([10, 20, 35][lv - 1]); break;
      case "fire_breath": v = dmgV([50, 70, 90][lv - 1] * (hasM() ? MAGIC.elem(f, "fire") : 1)); break;
      case "frost_breath": v = dmgV([50, 70, 90][lv - 1]) + Math.min(3, remT) * 0.5 * d; break;
      case "ice_form": v = f.eParalyzed > 0 ? -1 : stun([3, 5, 8][lv - 1]); break;
      case "become_ethereal": v = f.pw.ether > 0 ? -1 : stun([3, 5, 8][lv - 1]) - 0.6; break;   // you still swing while ethereal? no: it only saves blows
      case "disarm": v = f.pw.disarm ? -1 : [0.3, 0.45, 0.6][lv - 1] * Math.min(remT, 15) * d; break;
      case "kynes_peace": v = f.tags.has("beast") && !(f.calmTurns > 0) ? stun([5, 8, 12][lv - 1]) : -1; break;
      case "dragon_aspect": v = f.pw.aspect ? -1 : ([0.2, 0.35, 0.5][lv - 1] * Math.min(remT, 15)) + [0.15, 0.25, 0.35][lv - 1] * Math.min(remT, 15) * d - 1; break;
      default: if (typeof SHOUTS2 !== "undefined" && SHOUTS2.NEW[arg]) v = SHOUTS2.aiValue(f, arg, lv, { stun, dmgV, remT, d, dps: p.dps }); break;   // the newer shouts (shouts2.js)
    }
    else if (arg === "race") {
      const r = s.race, tg = f.tags;
      v = r === "nord" || (r === "imperial" && tg.has("humanoid")) ? stun(8) : r === "bosmer" && tg.has("beast") ? stun(10) : r === "orc" ? Math.min(10, remT) * (1 + 0.5 * d) - 1 : r === "argonian" ? healV(f, { ...p, missing: p.missing + G.maxHealth(s) * 0.3 }, G.maxHealth(s) * 0.7)
        : r === "dunmer" ? 8 * Math.min(10, remT) / p.dps : r === "khajiit" ? Math.max(0, swing({ __proto__: f, sneakNext: true }, false) - swing(f, false)) / p.dps : r === "breton" ? ((tg.has("mage") || tg.has("dragon")) ? 0.5 * Math.min(10, remT) * d : 0) : r === "redguard" ? (f.sp < f.paCost ? 3 : 0.5) : r === "altmer" ? (p.bestSpell && f.mp < p.bestSpell.c ? 4 : 0.3) : 0;
    } else if (arg === "stone") {
      const st = POWERS.stone(s);
      v = st === "serpent" ? stun(5) + dmgV(25) : st === "ritual" ? 8 * Math.min(remT, 10) / p.dps : st === "shadow" ? 1 : 0;
    } else if (arg === "beast" || arg === "lord") {   // a form for the rest of the fight: worth it when the fight is long enough to use it
      const reliant = (p.margin < 0.6 && s.inv.some((r) => D.ITEMS[r.item]?.restore?.[0] === "health")) ? 1 : 0;   // no potions while changed
      v = typeof CURSE.formValue === "function" ? CURSE.formValue(f, arg, remT, d, p.dps) - 1 - reliant : (danger && p.margin < 1 ? 3 : -1);
      if (remT < 2.5) v = -1;   // nearly over: not worth the change
      why = arg === "beast" ? "a long fight: the beast hits hardest" : "a long fight: the Lord drains it dry";
    }
    return { v: v - keep, why };
  }

  // ---- the turn's choice. Returns [action, reason or ""]
  function choose(f) {
    const p = picture(f);
    const op = typeof FAVWHEEL !== "undefined" ? FAVWHEEL.opener(f) : null;   // your readied favourite opens the fight
    if (op) { let r = null; try { r = value(f, p, op); } catch { /* fine */ } if (r && isFinite(r.v) && r.v > -0.5) { f.aiPlan = p; return [op, "your readied favourite"]; } }
    let best = "attack", bv = -Infinity, why = "";
    for (const a of options(f)) {
      let r; try { r = value(f, p, a); } catch { continue; }
      if (r && isFinite(r.v) && r.v > bv + 1e-9) { bv = r.v; best = a; why = r.why || ""; }
    }
    f.aiPlan = p;
    return [best, why];
  }

  // ---- followers fight smart too: cover you when you're hurt, punish an opening
  function followerAct(f, al) {
    const mh = G.maxHealth(f.s), base = al.dmg * avgSpread();
    const amax = typeof TOWNS !== "undefined" && f.s.follower ? TOWNS.followerMax(f.s, f.s.follower.id) : al.hp;
    if (f.hp / mh < 0.35 && al.hp > amax * 0.45 && f.ehp > base) { f.coverAl = al; const d = base * 0.6; f.ehp -= d; return ` · ${al.name} steps in front of you (${Math.round(d)})`; }
    if (f.eParalyzed > 0 || f.stagger || f.calmTurns > 0) { const d = base * 1.5; f.ehp -= d; return ` · ${al.name} hits the opening ${Math.round(d)}`; }
    const d = base; f.ehp -= d; return ` · ${al.name} ${Math.round(d)}`;
  }

  // ---- co-op: how your character fights beside friends, worked out from your kit (your phone, your setting)
  function coopProfile(s) {
    const heals = (s.spells || []).map((id) => [id, D.SPELLS[id]]).filter(([, sp]) => sp && sp.kind === "heal").sort((a, b) => (b[1].amount || 0) - (a[1].amount || 0));
    const eq = G.equipment(s), w = eq.weapon ? D.ITEMS[eq.weapon.item] : null;
    const healSp = heals.length && G.skill(s, "Restoration") >= 25 ? heals[0][1] : null;
    const role = healSp ? "healer" : eq.shield ? "guard" : w?.skill === "Two-Handed" || w?.skill === "One-Handed" ? "striker" : "fighter";
    return { role, sneaky: G.skill(s, "Sneak") >= 40, healAt: 45, healAmt: healSp ? Math.round(healSp.amount || 30) : 0, heals: healSp ? 3 : 0, potAt: 35, pots: Math.min(2, G.countRestore(s, "health")), potAmt: 50 };
  }

  const DESC = "Smart AI picks the best move every turn: the right spell for the foe's weakness, power attacks when you have the stamina, healing only when the fight is close, potions and shouts saved for when they matter.";
  return { isSmart, choose, followerAct, coopProfile, incoming, swing, options, picture, value, DESC };
})();
if (typeof module !== "undefined") module.exports = COMBATAI;
