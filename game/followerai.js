/* Followers as full characters in a fight, and their brains. [OURS module]
   Owner: "Followers should be like players, they can learn spells from tomes and use spells, wear any equipment, use
   potions, followers are being controlled by ai."

   What lives here (followers2.js keeps their pack, gear, levels and perks):
   - spells they know (taught from a spell tome out of your pack, if their skill in that school is high enough),
   - their magicka, stamina, pace and initiative in a fight, from their level and fighting style,
   - their tactics: Let them decide / Aggressive / Defensive / Healer / Ranged, and "save potions",
   - a turn: the same moves you have (attack, power attack, guard, cover you, every kind of spell they can cast,
     potions from their own pack), picked by the Smart AI below and paced like yours (a few moves a turn),
   - rows: Ranged and Healer followers stand in the back row and draw fewer blows; Defensive ones draw more.
   Balance: a full turn of plain attacks deals what one follower blow dealt before (their damage is shared out over their pace: an inner budget of effort per turn, never shown),
   so the extra depth comes from choices (spells, potions, heals, guarding), not from bigger numbers. */
const FAI = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = () => 0.85 + Math.random() * 0.3;
  const TIERC = { Novice: 2, Apprentice: 3, Adept: 4, Expert: 5, Master: 6 };     // how much of their pace a spell takes
  const WCOST = { dagger: 2, fist: 2, sword: 2, axe: 2, mace: 2, spear: 2, staff: 2, greatsword: 4, battleaxe: 4, warhammer: 4, bow: 4, crossbow: 5 };
  const REQ = { Novice: 0, Apprentice: 25, Adept: 50, Expert: 75, Master: 90 };   // [OURS] school skill a follower needs to learn a tome
  const TIER_EFF = { Novice: 1, Apprentice: 1.08, Adept: 1.15, Expert: 1.25, Master: 1.4 };   // bigger spells do more per point of pace
  const BACK = 0.6, FRONT = 1, TAUNT = 1.3;   // how many blows each row draws (you count as 1)

  /* tactics the player can set on the follower screen */
  const TACTICS = {
    auto: { name: "Let them decide", desc: "They fight their own way, by their style." },
    aggressive: { name: "Aggressive", desc: "Front row. Power attacks and damage spells first, heal only when it's bad." },
    defensive: { name: "Defensive", desc: "Front row and draws blows. Guards, steps in front of you when you're hurt, armor spells." },
    healer: { name: "Healer", desc: "Back row. Heals and wards you and the party first, then fights." },
    ranged: { name: "Ranged", desc: "Back row. Bow or spells from a distance, never steps in front of you." },
  };
  /* spells they start with, by style (only the ones their skill allows) */
  const START = { mage: ["flames", "frostbite", "healing", "oakflesh"], conjurer: ["flames", "conjure_familiar", "raise_zombie"], healer: ["healing", "lesser_ward", "fast_healing"],
    spellsword: ["flames", "healing"], warrior: [], twohand: [], archer: [], thief: [] };
  /* what they can do with each kind of spell in a fight; everything else they know but don't use in fights */
  const USABLE = new Set(["damage", "dot", "cloak", "rune", "heal", "regen", "healally", "armor", "allyarmor", "ward", "allyward", "summon", "reanimate", "calm", "fear", "turn", "paralyze", "absorb", "bound"]);

  const fol = () => (typeof FOL2 !== "undefined" ? FOL2 : null);
  const itemOf = (r) => (r ? D.ITEMS[r.item] : null);
  const skill = (f, k) => (fol() ? fol().skillOf(f, k) : 15);
  const tierOf = (id) => D.SPELLS[id]?.level || (typeof TOMES !== "undefined" ? TOMES.level(id) : "Novice");
  const archOf = (f) => (fol()?.ARCH[f.arch]) || { main: [], sec: [], role: "fighter" };

  // ------------------------------------------------------------------ the stored character (s.folData[id])
  /* fill in what older saves don't have: known spells, tactics */
  function seed(f) {
    if (!f) return f;
    if (!Array.isArray(f.spells)) { f.spells = []; for (const id of START[f.arch] || []) if (D.SPELLS[id] && canLearn(f, id) === true) f.spells.push(id); }
    if (!f.tactic || !TACTICS[f.tactic]) f.tactic = "auto";
    if (!Array.isArray(f.off)) f.off = [];   // spells you told them not to use
    return f;
  }
  /* true, or why not */
  const pnum = (s, k) => (s && typeof PFX !== "undefined" ? PFX.num(s, k) || 0 : 0);   // Battle Tutor (Speechcraft)
  function canLearn(f, id, s) {
    const sp = D.SPELLS[id]; if (!sp) return "That's not a spell.";
    const t = tierOf(id), need = Math.max(0, (REQ[t] ?? 0) - (REQ[t] ? pnum(s, "folteach") : 0)), have = skill(f, sp.school);
    if (have < need) return `needs ${sp.school} ${need} for a ${t} spell (has ${have})`;
    return true;
  }
  const nameOf = (s, id = s.follower?.id) => (typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[id]?.[0]) || id;
  /* give them a spell tome from your pack */
  function teach(s, invId) {
    const F2 = fol(); if (!F2 || !s.follower) return "No follower.";
    const f = seed(F2.st(s)), r = G.invRow(s, invId), it = itemOf(r);
    if (!r || !it || it.slot !== "tome" || !D.SPELLS[it.spell]) return "That's not a spell tome.";
    const who = nameOf(s), sp = D.SPELLS[it.spell];
    if (f.spells.includes(it.spell)) return `${who} already knows ${sp.name}.`;
    const ok = canLearn(f, it.spell, s);
    if (ok !== true) return `${who} can't learn ${sp.name} yet: ${ok}.`;
    G.take(s, r.id, 1); f.spells.push(it.spell);
    return `${who} reads the tome and learns ${sp.name}.${USABLE.has(sp.kind) ? "" : " (They won't use it in fights.)"}`;
  }
  function toggle(s, id) {
    const F2 = fol(); if (!F2) return "";
    const f = seed(F2.st(s)); if (!f.spells.includes(id)) return "";
    f.off = f.off.includes(id) ? f.off.filter((x) => x !== id) : [...f.off, id];
    return `${nameOf(s)} ${f.off.includes(id) ? "won't cast" : "will cast"} ${D.SPELLS[id].name} in fights.`;
  }
  function setTactic(s, t) {
    const F2 = fol(); if (!F2 || !TACTICS[t]) return "";
    const f = seed(F2.st(s)); f.tactic = t;
    return `${nameOf(s)}: ${TACTICS[t].name.toLowerCase()}.`;
  }
  function setSavePots(s, on) { const F2 = fol(); if (!F2) return ""; const f = seed(F2.st(s)); f.savePots = !!on; return on ? `${nameOf(s)} will keep potions for emergencies.` : `${nameOf(s)} will drink potions when needed.`; }

  /* their pools and pace in a fight, from level and style ([OURS] in the same scale as yours) */
  function pools(f) {
    const a = archOf(f), mage = a.mage || 0, L = f.lvl || 1;
    const heavy = Object.values(f.eq || {}).some((id) => itemOf(f.inv.find((r) => r.id === id))?.type === "heavy");
    const u = f.ups;   // folbuild.js: +10 magicka / stamina for each pick at their level-ups
    return {
      mp: Math.round(60 + 140 * mage + (u ? 1 * (L - 1) + 10 * (u.magicka || 0) : 4 * (L - 1)) + (f.spells?.length ? 20 : 0)),
      sp: Math.round(100 + (u ? 1 * (L - 1) + 10 * (u.stamina || 0) : 3 * (L - 1)) + (mage >= 1 ? -20 : 20)),
      ap: clamp(6 + Math.floor(L / 20), 6, 8),
      init: Math.round(8 + skill(f, "Sneak") / 20 + (a.sneaky ? 2 : 0) - (heavy ? 1 : 0)),
    };
  }
  const rowOf = (f) => { const t = f.tactic || "auto", a = archOf(f); if (t === "ranged" || t === "healer") return "back"; if (t === "aggressive" || t === "defensive") return "front"; return a.weapon === "Archery" || a.mage >= 1 || a.role === "healer" ? "back" : "front"; };

  /* set up the fight record for your own follower (called from FOL2.ally) */
  function equipAlly(s, f, rec) {
    seed(f);
    const p = pools(f), wRow = f.inv.find((r) => r.id === f.eq.weapon), w = itemOf(wRow);
    const offRow = f.inv.find((r) => r.id === f.eq.offhand), sh = itemOf(f.inv.find((r) => r.id === f.eq.shield));
    Object.assign(rec, { fai: true, maxHp: fol().maxHp(s, rec.fid), mp: p.mp, mpMax: p.mp, sp: p.sp, spMax: p.sp, ap: p.ap, init: p.init,
      tactic: f.tactic, savePots: !!f.savePots, row: rowOf(f), wt: w ? (G.wtype ? G.wtype(wRow.item) : "sword") : "fist", bow: !!(w && w.skill === "Archery"),
      shield: !!sh, dual: !!offRow, sneaky: !!archOf(f).sneaky, arch: f.arch, lvl: f.lvl,
      spells: f.spells.filter((id) => D.SPELLS[id] && USABLE.has(D.SPELLS[id].kind) && !f.off.includes(id) && canLearn(f, id, s) === true),
      mpCut: pnum(s, "folmp"),
      boost: 1, sp0: null, melee: archOf(f).mage >= 1 && (!w || w.staff) ? Math.max(1, 4 * (1 + skill(f, "Hand-to-Hand") / 200) * 0.55 * (w?.staff ? 2 : 1)) : null });
    if (!rec.maxHp || rec.maxHp < rec.hp) rec.maxHp = Math.max(rec.hp || 1, rec.maxHp || 1);
    if (typeof FBUILD !== "undefined") FBUILD.equip(s, f, rec);   // the skill each action trains, their perks' real effects
    return rec;
  }

  // ------------------------------------------------------------------ numbers for one action
  /* what one point of pace is worth: their usual blow spread over their pace (so a turn of attacks = one old blow) */
  const blow = (al) => al.melee ?? al.dmg ?? 4;   // a mage's fists are weak: their damage is in their spells
  const unit = (al) => { const wc = WCOST[al.wt] || 2; return blow(al) / (Math.max(1, Math.floor((al.ap || 6) / wc)) * wc); };
  const powerHit = (al) => Math.min(unit(al) * (WCOST[al.wt] || 2) * 2, blow(al) * 1.15);   // a power attack: about a turn of blows, plus the stagger   // slow weapons and bows: one shot a turn still = one old blow
  /* the power behind their spells: like followers2's spell estimate, from the skill of the school, per point of pace */
  function spellUnit(fight, al, sp) {
    const f = folOf(fight, al); if (!f) return unit(al);
    const aug = Math.max(rank(f, "augmented_flames"), rank(f, "augmented_frost"), rank(f, "augmented_shock"));
    const staff = itemOf(f.inv.find((r) => r.id === f.eq.weapon))?.staff ? 1.15 : 1;
    const raw = (6 + skill(f, sp.school) * 0.18) * (sp.school === "Destruction" ? (1 + 0.25 * aug) * (al.px?.spell || 1) : 1) * staff * 0.55;
    return raw * (al.boost || 1) / Math.max(1, al.ap || 6);
  }
  const rank = (f, id) => f.perks?.[id] || 0;
  const folOf = (fight, al) => fight?.s?.folData?.[al.fid] || null;
  const mpCost = (f, sp, cut = 0) => Math.max(4, Math.round((sp.cost || 20) * 0.7 * (1 - Math.min(0.5, skill(f, sp.school) / 250)) * (1 - Math.min(0.4, cut))));
  const foeLvl = (fight) => fight.e.level ?? fight.s.level ?? 1;
  const isBoss = (fight) => !!fight.e.boss || (fight.tags && fight.tags.has("boss"));
  const elemMul = (fight, el) => (typeof MAGIC !== "undefined" && el && el !== "sun" ? MAGIC.elem(fight, el) : 1);
  const immune = (fight, el) => { if (!el || el === "sun") return false; const st = { fire: "burn", frost: "chill", shock: "shock" }[el]; return elemMul(fight, el) < 0.7 && !!st; };
  const playerPct = (fight) => fight.hp / Math.max(1, G.maxHealth(fight.s));
  const selfPct = (al) => al.hp / Math.max(1, al.maxHp || al.hp || 1);
  const SUMMON_KIND = { conjure_familiar: "familiar", flaming_familiar: "familiar", flame_atronach: "flame_atronach", frost_atronach: "frost_atronach", storm_atronach: "storm_atronach", dremora_lord: "dremora", spectral_archer: "valor", seeker: "familiar" };
  const potionRows = (f, res) => (f ? f.inv.filter((r) => itemOf(r)?.slot === "potion" && itemOf(r).restore?.[0] === res).sort((x, y) => itemOf(x).restore[1] - itemOf(y).restore[1]) : []);
  const mySummon = (fight, al) => fight.allies.find((x) => x.fsum && x.owner === al.fid + ":" + al.name);
  const actorId = (fight, al) => "al" + Math.max(0, fight.allies.indexOf(al));

  /* everything this follower could do now, with what it costs. kind: attack | power | guard | cover | cast | potion */
  function options(fight, al, ap) {
    const f = folOf(fight, al), out = [], tac = al.tactic || "auto", wc = WCOST[al.wt] || 2;
    const pp = playerPct(fight), me = selfPct(al), boss = isBoss(fight);
    const cv = al.order === "defend" ? 0.7 : 0.45;   // ordered to defend you: steps in front of you sooner (strategy.js)
    out.push({ k: "attack", c: wc, v: unit(al) * wc * opener(fight, al) * comboPhys(fight, al) });
    if (al.sp >= 25) out.push({ k: "power", c: wc + 2, v: powerHit(al) * comboPhys(fight, al) + (al.bow ? 0 : unit(al) * 2 * (boss ? 0.15 : 0.35)) * (tac === "aggressive" ? 1.4 : 1) });
    if (!al.guard) out.push({ k: "guard", c: 2, v: (tac === "defensive" ? 2.2 : tank(al) ? 1.2 : 0.9) * unit(al) * (al.shield ? 1.4 : 1) * (pp < 0.5 ? 1.5 : 1) * (me < 0.5 ? 1.3 : 1) });
    if (tac !== "ranged" && !al.bow && (tac === "defensive" || (al.shield && tac === "auto")) && pp < cv && me > 0.45 && fight.coverAl !== al) out.push({ k: "cover", c: 2, v: unit(al) * 8 * (cv - pp) / cv + unit(al) * 3 });
    // potions from their own pack
    const potAt = al.savePots ? 0.2 : tac === "aggressive" ? 0.4 : 0.5;   // potions work over a few rounds (potionfx.js): drink a bit earlier
    const potOn = (res) => typeof POTFX !== "undefined" && POTFX.busy(al, res);   // one of that kind still working: not again
    if (me < potAt && potionRows(f, "health").length && !potOn("health")) out.push({ k: "potion", res: "health", c: 1, v: unit(al) * 20 * (potAt - me + 0.1) });
    if (!al.savePots && al.spells.length && al.mp < 0.2 * al.mpMax && potionRows(f, "magicka").length && !potOn("magicka")) out.push({ k: "potion", res: "magicka", c: 1, v: unit(al) * 4 });
    if (!al.savePots && al.sp < 25 && (tac === "aggressive" || al.arch === "twohand") && potionRows(f, "stamina").length && !potOn("stamina")) out.push({ k: "potion", res: "stamina", c: 1, v: unit(al) * 2 });
    // spells
    for (const id of al.spells) {
      const sp = D.SPELLS[id]; if (!sp || !f) continue;
      const c = TIERC[tierOf(id)] || 3, cost = mpCost(f, sp, al.mpCut); if (cost > al.mp) continue;
      const v = spellValue(fight, al, f, id, sp, c, { pp, me, tac, boss });
      if (v > 0) out.push({ k: "cast", id, sp, c, mp: cost, v });
    }
    return out.filter((o) => o.c <= ap);
  }
  /* how much a spell is worth right now (in "damage" points, so it competes with swinging) */
  function spellValue(fight, al, f, id, sp, c, ctx) {
    const u = spellUnit(fight, al, sp) * c * (TIER_EFF[tierOf(id)] || 1), healer = ctx.tac === "healer" || (ctx.tac === "auto" && archOf(f).role === "healer");
    const healAt = healer ? 0.7 : ctx.tac === "aggressive" ? 0.3 : 0.5;
    switch (sp.kind) {
      case "damage": case "absorb": {
        if (sp.element === "sun" && !fight.tags.has("undead")) return 0;
        const m = elemMul(fight, sp.element);
        if (m < 0.7) return 0;
        return u * m * comboEl(fight, al, sp.element) * (healer ? 0.8 : 1) * (ctx.tac === "aggressive" ? 1.1 : 1) * (sp.kind === "absorb" && ctx.me < 0.6 ? 1.3 : 1) * statusBonus(fight, sp.element);
      }
      case "dot": case "cloak": return (fight.dots || []).some((x) => x.by === al.name) ? 0 : u * 1.2 * elemMul(fight, sp.element);
      case "rune": return fight.rune ? 0 : u * 1.15 * elemMul(fight, sp.element);
      case "heal": case "regen": case "healally": {
        const tgt = healTarget(fight, al, healAt); if (!tgt) return 0;
        if (al.healed && !(tgt === "me" ? ctx.pp < 0.3 : selfPct(tgt) < 0.3)) return 0;   // one heal a turn, unless it's bad
        const amt = healAmt(f, sp, tgt !== al), miss = tgt === "me" ? G.maxHealth(fight.s) - fight.hp : (tgt.maxHp || tgt.hp) - tgt.hp;
        return Math.min(amt, miss) * (tgt === "me" ? 1.4 : 1) * (healer ? 1.4 : 1);
      }
      case "armor": return al.armorRed > 0 || ctx.me > 0.85 && ctx.tac !== "defensive" ? 0 : u * (rowOf(f) === "front" ? 1.6 : 0.8);
      case "allyarmor": return (fight.armorSpell || 0) >= sp.amount || ctx.pp > 0.8 ? 0 : u * 1.4;
      case "ward": case "allyward": { const caster = typeof MAGIC !== "undefined" && MAGIC.isCaster(fight); if (caster && !(fight.ward > 0)) return u * (healer ? 2 : 1.3); return al.ward > 0 || ctx.me > 0.7 ? 0 : u * 0.9; }
      case "summon": case "reanimate": return mySummon(fight, al) || fight.ehp < 0.3 * (fight.ehp0 || fight.ehp) ? 0 : u * 2.2 * (archOf(f).main.includes("Conjuration") ? 1.3 : 1);
      case "calm": case "fear": case "paralyze": case "turn": {
        if (al.ccUsed || ctx.boss || fight.eParalyzed > 0 || fight.calmTurns > 0) return 0;
        if (sp.kind === "turn" && !fight.tags.has("undead")) return 0;
        if ((sp.kind === "calm" || sp.kind === "fear") && (fight.tags.has("undead") || fight.tags.has("construct"))) return 0;
        if (sp.kind !== "paralyze" && foeLvl(fight) > (sp.max_level || 10) + skill(f, sp.school) / 4) return 0;
        return fight.ehp > 0.4 * (fight.ehp0 || fight.ehp) ? u * 1.8 : 0;
      }
      case "bound": return al.bound ? 0 : u * 1.1;
    }
    return 0;
  }
  const healAmt = (f, sp, other) => Math.round(Math.max(10, sp.amount || 10) * (1 + skill(f, "Restoration") / 100) * (other && sp.kind === "heal" ? 0.75 : 1) * 0.85 + 5);
  /* who needs healing most: "me" (the player), an ally record, or null */
  function healTarget(fight, al, at) {
    const pp = playerPct(fight);
    let best = pp < at ? { t: "me", p: pp * 0.9 } : null;   // you come first at the same health
    for (const x of fight.allies) { if (x.hp == null || x.fsum || x.down || !(x.maxHp > 0)) continue; const p = x.hp / x.maxHp; if (p < at * 0.8 && (!best || p < best.p)) best = { t: x, p }; }
    return best ? best.t : null;
  }
  /* sneak archers and thieves open the fight with a sneak attack */
  const opener = (fight, al) => (al.sneaky && !al.opened && (fight.turn || 0) <= 1 ? 1.5 : 1);
  /* combos (combo.js): a chilled foe shatters under a heavy blow from someone else, a staggered one takes more */
  const comboPhys = (fight, al) => (typeof COMBO !== "undefined" ? COMBO.physValue(fight, actorId(fight, al)) : 1);
  const comboEl = (fight, al, el) => (typeof COMBO !== "undefined" ? COMBO.elValue(fight, actorId(fight, al), el) : 1);
  const statusBonus = (fight, el) => { const st = { fire: "burn", frost: "chill", shock: "shock" }[el]; return st && !fight.foeSt?.[st] ? 1.08 : 1; };

  /* Smart AI for followers: the best option per point of pace, with the tactic's leanings. Returns one option or null. */
  function decide(fight, al, ap = al.ap || 6) {
    let opts = options(fight, al, ap);
    if (typeof BONDS2 !== "undefined") opts = BONDS2.aiOpts(fight, al, opts);   // Trusted followers choose better (bonds.js)
    if (al.order === "hold" && typeof STRAT !== "undefined") opts = opts.filter((o) => STRAT.allowed(al, o));   // your order: Hold back (strategy.js)
    if (!opts.length) return null;
    let best = null, bv = -1;
    for (const o of opts) { const v = o.v / Math.max(1, o.c) * (o.k === "guard" ? 0.8 : 1) * (typeof REACT !== "undefined" ? REACT.value(fight, al, o) : 1); if (v > bv) { bv = v; best = o; } }   // a combo waiting (reactions.js)
    return best;
  }

  // ------------------------------------------------------------------ doing it
  const name = (al) => al.name;
  function doPotion(fight, al, res) {
    const f = folOf(fight, al), p = potionRows(f, res)[0]; if (!p) return null;
    const it = itemOf(p), amt = it.restore[1];
    if (typeof POTFX !== "undefined") { p.qty--; if (p.qty <= 0) f.inv = f.inv.filter((x) => x !== p); return { text: `${name(al)} drinks a ${it.name}: ${POTFX.ally(al, res, amt, it.name)}`, self: 0 }; }   // over a few rounds (potionfx.js)
    if (res === "health") al.hp = Math.min(al.maxHp || al.hp + amt, al.hp + amt);
    else if (res === "magicka") al.mp = Math.min(al.mpMax, al.mp + amt);
    else al.sp = Math.min(al.spMax, al.sp + amt);
    p.qty--; if (p.qty <= 0) f.inv = f.inv.filter((x) => x !== p);
    return { text: `${name(al)} drinks a ${it.name} (+${Math.round(amt)})`, self: res === "health" ? amt : 0 };
  }
  function doCast(fight, al, o) {
    const f = folOf(fight, al), sp = o.sp, id = o.id, u = spellUnit(fight, al, sp) * o.c * (TIER_EFF[tierOf(id)] || 1);
    al.mp -= o.mp;
    const n = name(al);
    switch (sp.kind) {
      case "damage": case "absorb": {
        if (Math.random() > (typeof F !== "undefined" ? F.SPELL_HIT_CHANCE : 0.95)) return { text: `${n} casts ${sp.name}, but it misses` };
        let d = u * elemMul(fight, sp.element) * rnd();
        if (fight.wx?.el?.[sp.element]) d *= fight.wx.el[sp.element];
        let tag = "";
        if (fight.fp && fight.fp.ward) { d *= 1 - fight.fp.ward; tag = " (warded)"; }
        fight.ehp -= d;
        if (sp.kind === "absorb") al.hp = Math.min(al.maxHp || al.hp, al.hp + d * 0.5);
        if (sp.element === "frost") fight.slowed = Math.max(fight.slowed || 0, 1);
        const st = typeof PFX !== "undefined" && sp.element && sp.element !== "sun" ? PFX.hitFoe(fight, sp.element, d, "spell") : "";
        return { text: `${n} casts ${sp.name}: ${Math.round(d)}${tag}${st}`, dmg: d, el: sp.element };
      }
      case "dot": case "cloak": {
        fight.dots = fight.dots || [];
        fight.dots.push({ name: `${n}'s ${sp.name}`, dmg: u * 0.45, el: sp.element, turns: 3, by: n });
        return { text: `${n} casts ${sp.name}: the ${String(fight.e.name).toLowerCase()} is caught in it` };
      }
      case "rune": { fight.rune = { name: `${n}'s ${sp.name}`, dmg: u * 1.3, el: sp.element }; return { text: `${n} lays a ${sp.name}` }; }
      case "heal": case "regen": case "healally": {
        const tgt = healTarget(fight, al, 0.95) || al, amt = healAmt(f, sp, tgt !== al); al.healed = true;
        if (tgt === "me") { const b = fight.hp; fight.hp = Math.min(G.maxHealth(fight.s), fight.hp + amt); return { text: `${n} heals you with ${sp.name}: +${Math.round(fight.hp - b)}`, healed: fight.hp - b }; }
        const b = tgt.hp; tgt.hp = Math.min(tgt.maxHp || tgt.hp + amt, tgt.hp + amt);
        return { text: tgt === al ? `${n} casts ${sp.name}: +${Math.round(tgt.hp - b)}` : `${n} heals ${tgt.name}: +${Math.round(tgt.hp - b)}` };
      }
      case "armor": al.armorRed = Math.min(0.45, (sp.amount || 40) / 220 * (1 + skill(f, "Alteration") / 200)); al.armorT = 99; return { text: `${n} casts ${sp.name} (blows hurt them ${Math.round(al.armorRed * 100)}% less)` };
      case "allyarmor": fight.armorSpell = Math.max(fight.armorSpell || 0, sp.amount || 25); return { text: `${n} casts ${sp.name} on you: +${Math.round(sp.amount || 25)} armor` };
      case "ward": case "allyward": {
        const amt = Math.round((sp.amount || 40) * (1 + skill(f, sp.school) / 200));
        if (typeof MAGIC !== "undefined" && MAGIC.isCaster(fight) && !(fight.ward > 0)) { fight.ward = amt; fight.wardMax = amt; return { text: `${n} raises ${sp.name} around you (soaks ${amt} magic)` }; }
        al.ward = Math.round(amt * 0.6); return { text: `${n} raises ${sp.name} (soaks ${al.ward})` };
      }
      case "summon": case "reanimate": {
        const who = String(sp.name).replace(/^(Conjure|Raise|Reanimate) /, "");
        const pow = (sp.amount || 6) * (1 + skill(f, sp.school) / 150);
        const sm = { name: `${who} (${n})`, dmg: Math.max(2, pow * 0.35) * (al.boost || 1), hp: Math.round(30 + pow * 4), maxHp: Math.round(30 + pow * 4), fsum: true, summon: true,
          owner: al.fid + ":" + al.name, turns: 5, kind: SUMMON_KIND[id] || (sp.kind === "reanimate" ? "zombie" : "familiar"), init: 6 };
        fight.allies.push(sm);
        return { text: `${n} casts ${sp.name}: ${/^[aeiou]/i.test(who) ? "an" : "a"} ${who} joins the fight` };
      }
      case "calm": case "fear": case "turn": al.ccUsed = true; fight.calmTurns = Math.max(fight.calmTurns || 0, 1); return { text: `${n} casts ${sp.name}: the ${String(fight.e.name).toLowerCase()} falters and loses its next move` };
      case "paralyze": al.ccUsed = true; fight.eParalyzed = Math.max(fight.eParalyzed || 0, 1); return { text: `${n} casts ${sp.name}: the ${String(fight.e.name).toLowerCase()} is paralyzed` };
      case "bound": al.bound = 1.2; al.boost = (al.boost || 1) * 1.2; return { text: `${n} conjures a ${sp.name.replace(/^Bound /, "bound ")}` };
    }
    return { text: `${n} casts ${sp.name}` };
  }
  function doOne(fight, al, o) {
    const n = name(al);
    if (o.k === "potion") return doPotion(fight, al, o.res) || { text: `${n} looks for a potion` };
    if (o.k === "cast") return doCast(fight, al, o);
    if (o.k === "guard") { al.guard = 1; return { text: `${n} ${al.shield ? "raises their shield" : "keeps their guard up"}` }; }
    if (o.k === "cover") { fight.coverAl = al; al.guard = 1; return { text: `${n} steps in front of you` }; }
    // attack / power attack
    const wc = WCOST[al.wt] || 2, power = o.k === "power";
    if (power) al.sp -= 25;
    if (Math.random() > (typeof F !== "undefined" ? F.HIT_CHANCE + 0.05 : 0.9) + (al.px?.hit || 0)) return { text: `${n} ${power ? "swings hard and" : ""} misses`.replace("  ", " ") };
    let d = (power ? powerHit(al) * (al.px?.pow || 1) : unit(al) * wc) * (al.px?.out || 1) * rnd(), tag = "";   // their perks (folbuild.js mods)
    const op = opener(fight, al); if (op > 1) { d *= op; al.opened = true; tag = " (sneak attack)"; }
    if (al.dual && !al.bow) { d *= 1.1; }
    fight.ehp -= d;
    if (power && !al.bow && fight.ehp > 0 && Math.random() < (isBoss(fight) ? 0.15 : /hammer|mace|battleaxe/.test(al.wt) ? 0.5 : 0.35)) { fight.stagger = true; tag += ", staggers it"; }
    const verb = al.bow ? (power ? "takes an aimed shot" : "shoots") : power ? "power attacks" : "hits";
    return { text: `${n} ${verb} ${Math.round(d)}${tag}`, dmg: d, phys: true };
  }

  /* one whole follower turn. sess = the turn-based Session (or null in an instant fight: then one turn's worth of pace
     per exchange). Returns the line for an instant fight. */
  function turn(sess, fight, al) {
    if (al.down || al.hp <= 0 || fight.ehp <= 0) return "";
    // a new turn: breath and magicka come back a little; their guard from last turn drops
    al.mp = Math.min(al.mpMax, al.mp + al.mpMax * 0.06); al.sp = Math.min(al.spMax, al.sp + al.spMax * 0.1); al.guard = 0; al.healed = false;
    tickSummon(fight, al);
    let ap = al.ap || 6, guard = 0;
    const parts = [], aid = actorId(fight, al), prev = fight.cActor; fight.cActor = aid;
    try {
      while (ap > 0 && fight.ehp > 0 && guard++ < 6) {
        const o = decide(fight, al, ap);
        if (!o) break;
        if (o.k === "guard" && parts.length && (al.tactic !== "defensive")) break;   // leftover pace becomes guard below
        const before = fight.ehp, myB = fight.hp, rxPre = typeof REACT !== "undefined" ? REACT.pre(fight) : null;
        const r = doOne(fight, al, o); ap -= o.c;
        if (typeof FBUILD !== "undefined") FBUILD.acted(fight, al, o, r);   // their skills rise with use, like yours
        let t = r.text;
        const rx = r.phys && fight.ehp < before && typeof REACT !== "undefined" ? REACT.ally(sess, fight, al, o.k, before, rxPre) : { key: null };   // Shatter, Exploit, Precision... (reactions.js)
        if (rx.key) { t += rx.text; fight._rxPend = rx.key; }
        else if (r.phys && fight.ehp < before && typeof COMBO !== "undefined") t += COMBO.phys(fight, before, aid);
        if (o.k === "cast" && fight.hp > myB && fight.bf && typeof BOSSFIGHT !== "undefined" && BOSSFIGHT.cleanse) t += BOSSFIGHT.cleanse(fight);   // their healing washes a boss's hex off you
        if (sess && fight.ehp < before) { t += sess.capFoe(before); t += sess.flank(before); sess.hitters++; }
        if (fight.ehp < before && typeof COMBO !== "undefined" && !rx.key) t += COMBO.opening(fight, before, aid);
        if (sess) { sess.lines.me.push(t); sess.emit("ally", t, "ally", { name: al.name, dmg: Math.max(0, Math.round(before - fight.ehp)), healed: Math.max(0, Math.round(fight.hp - myB)), a: o.k === "cast" ? "spell:" + o.id : o.k === "power" ? "power_attack" : "attack", wt: al.wt }); }
        else parts.push(t);
        if (o.k === "guard" || o.k === "cover") break;
      }
      if (ap >= 2 && !al.guard && fight.ehp > 0) { al.guard = 1; const t = `${al.name} keeps their guard up`; if (sess) { sess.lines.me.push(t); sess.emit("ally", t, "ally", { name: al.name, dmg: 0 }); } }
    } finally { fight.cActor = prev; }
    return parts.length ? " · " + parts.join(" · ") : "";
  }
  /* their summon fades after a few of their turns */
  function tickSummon(fight, al) {
    const sm = mySummon(fight, al); if (!sm) return;
    if (--sm.turns <= 0) fight.allies = fight.allies.filter((x) => x !== sm);
  }

  // ------------------------------------------------------------------ being hit (engine.js enemyTurnInner calls these)
  /* a sword-and-shield follower left to their own style is a tank: they draw blows like Defensive */
  const tank = (al) => !!al.fai && (al.tactic || "auto") === "auto" && al.shield && (al.build || al.arch) === "warrior";
  const weight = (al) => (!al.fai ? FRONT : al.order === "hold" ? BACK : al.tactic === "defensive" || tank(al) ? TAUNT : al.row === "back" ? BACK : FRONT);
  /* how many "targets" the allies add up to (you count as 1): back-row allies draw fewer blows */
  const aggro = (fight) => fight.allies.reduce((a, x) => a + weight(x), 0);
  function pickAlly(fight) {
    const all = fight.allies, tot = aggro(fight); let r = Math.random() * tot;
    for (const x of all) { r -= weight(x); if (r <= 0) return x; }
    return all[all.length - 1];
  }
  /* a follower guarding with a shield takes much less */
  function takes(fight, al, d) {
    if (!(d > 0) || !al.guard) return d;
    const f = folOf(fight, al), pct = Math.min(0.75, (al.shield ? 0.45 : 0.3) + (f ? skill(f, "Blocking") / 400 : 0) + (al.px?.block || 0));
    return d * (1 - pct);
  }
  /* a summon is hit: it takes the blow and fades when it runs out of health (never "knocked down") */
  function hitSummon(fight, al) {
    const n = fight.e.name;
    if (Math.random() > (typeof F !== "undefined" ? F.HIT_CHANCE : 0.8)) return `${n} swings at the ${al.name} and misses`;
    const d = fight.e.damage * rnd() * 0.8; al.hp -= d;
    if (al.hp <= 0) { fight.allies = fight.allies.filter((x) => x !== al); return `${n} destroys the ${al.name}`; }
    return `${n} hits the ${al.name} ${Math.round(d)}`;
  }

  // ------------------------------------------------------------------ the fight screen: one line under their health
  function frame(a) {
    if (!a.fai) return "";
    const pc = (v, m) => (100 * Math.max(0, v) / Math.max(1, m)).toFixed(1);
    const t = TACTICS[a.tactic] || TACTICS.auto;
    return `<div class="faibars"><div class="tbbar mp"><i style="width:${pc(a.mp, a.mpMax)}%"></i></div><div class="tbbar sp"><i style="width:${pc(a.sp, a.spMax)}%"></i></div></div><small class="fairow">${a.row === "back" ? "Back row" : "Front row"} · ${a.tactic === "auto" ? "own style" : t.name.toLowerCase()}</small>`;
  }

  // ------------------------------------------------------------------ the follower screen: Magic and Tactics tabs
  function magicTab(s, f, esc) {
    seed(f);
    const known = f.spells.map((id) => { const sp = D.SPELLS[id]; if (!sp) return ""; const use = USABLE.has(sp.kind), on = use && !f.off.includes(id);
      return `<div class="item ${on ? "on" : ""}"><div class="t">${esc(sp.name)} <span class="num">${esc(tierOf(id))}</span><span>${esc(sp.school)}${use ? ` · ${mpCost(f, sp, pnum(s, "folmp"))} magicka` : " · not used in fights"}</span></div>
        ${use ? `<button class="btn sm ${on ? "" : "pri"}" data-act="fol2" data-op="spell" data-id="${esc(id)}">${on ? "Don't use" : "Use"}</button>` : ""}</div>`; }).join("") || `<p class="sub">They don't know any spells. Teach them from a spell tome below.</p>`;
    const tomes = s.inv.filter((r) => itemOf(r)?.slot === "tome" && D.SPELLS[itemOf(r).spell]).map((r) => {
      const id = itemOf(r).spell, sp = D.SPELLS[id], knows = f.spells.includes(id), ok = canLearn(f, id, s);
      return `<div class="item"><div class="t">${esc(sp.name)} <span class="num">${esc(tierOf(id))}</span><span>${esc(sp.school)} · ${knows ? "already known" : ok === true ? "they can learn this" : esc(ok)}</span></div>
        <button class="btn sm pri" data-act="fol2" data-op="teach" data-id="${r.id}" ${knows || ok !== true ? "disabled" : ""}>Teach</button></div>`; }).join("") || `<p class="sub">No spell tomes in your pack. Court wizards sell them.</p>`;
    const p = pools(f);
    return `<p class="sub">${p.mp} magicka · they learn a tome if their skill in its school is high enough (Apprentice 25, Adept 50, Expert 75, Master 90${pnum(s, "folteach") ? `, ${pnum(s, "folteach")} less with Battle Tutor` : ""})</p>
      <h3>Spells they know</h3><div class="list fol2list">${known}</div><h3>Teach from your pack</h3><div class="list fol2list">${tomes}</div>`;
  }
  function tacticsTab(s, f, esc) {
    seed(f);
    const p = pools(f), row = rowOf(f);
    return `<p class="sub">How ${esc(nameOf(s))} fights. They take their own turns: attacks, power attacks, guarding, spells and potions from their pack, a few moves a turn like yours.</p>
      <div class="list fol2tac">${Object.entries(TACTICS).map(([k, v]) => `<button class="item tac ${f.tactic === k ? "on" : ""}" data-act="fol2" data-op="tactic" data-id="${k}"><div class="t">${esc(v.name)}${f.tactic === k ? " ✓" : ""}<span>${esc(v.desc)}</span></div></button>`).join("")}</div>
      <div class="chips"><button class="chip ${f.savePots ? "on" : ""}" data-act="fol2" data-op="savepots" data-id="${f.savePots ? 0 : 1}">${f.savePots ? "✓ " : ""}Save potions for emergencies</button></div>
      <p class="sub">${row === "back" ? "Back row: draws fewer blows" : "Front row: takes blows meant for you"} · initiative ${p.init} · ${p.mp} magicka · ${p.sp} stamina</p>`;
  }

  return { TACTICS, START, USABLE, REQ, seed, canLearn, teach, toggle, setTactic, setSavePots, pools, rowOf, equipAlly, options, decide, turn, doCast, aggro, pickAlly, takes, hitSummon, frame, magicTab, tacticsTab, mpCost, healAmt };
})();
if (typeof module !== "undefined") module.exports = FAI;
