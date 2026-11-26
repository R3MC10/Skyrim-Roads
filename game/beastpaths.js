/* Werewolf and vampire paths, part 2 [OURS] (on top of curses.js, which has the curses, Beast Form, Vampire Lord,
   hunger stages, feeding, the two perk trees and the two cure quests).
   What this adds:
   - Catching it: a werewolf's bite in a fight can pass on Moonblood (3 in-game days, then you change for the first
     time; a Cure Disease potion or a shrine stops it, like Sanguinare). A night road encounter with a wild werewolf,
     and the Ashen Court, a vampire noble's carriage that offers you the gift outright.
   - Real forms in turn-by-turn fights: in Beast Form your weapon hand is a claw. Claws and Maul (stamina),
     Pounce (stamina, staggers, every 3 rounds), Howl (once per change), Feast (once, on a beaten person), Change back.
     A Vampire Lord's dark moves and a vampire's powers cost health instead (build 145: no more action points).
     A Vampire Lord has Claws, Drain Life, Vampiric Grip, Raise Dead and Change back. No spells, scrolls, shouts or
     potions while changed. Drawbacks: silver weapons (Silver Hand, Vigilants, Dawnguard) bite harder, and Beast Form
     leaves you spent for a couple of rounds after you change back.
   - Vampires out of form: Vampire's Seduction, Embrace of Shadows (stage 3+) and a Bite to feed mid-fight. By day
     the sun burns you a little every round you fight outdoors, more the hungrier you are.
   - Townsfolk: hungry vampires pay more and, starving, are turned away at shop doors; a werewolf seen changing in a
     town is talked about (dearer prices in that hold for a day), and the barks change.
   - New perk stars in both trees, and two skill perks (Bane of the Night, Wolfsbane) in perkfx.js.
   - Party fights: your form travels with your turn, so every phone in a shared fight draws you as the beast.
   Everything is a wrapper around CURSE / G.Fight / TB / ENC; old saves and old perk ids are untouched. */
const BEASTPATH = (() => {
  const nowS = () => Date.now() / 1000;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const R = (s, tree, id) => (typeof CURSE !== "undefined" ? CURSE.rank(s, tree, id) : 0);
  const BITE = 0.3;                       // Moonblood from a werewolf's bite (curses.js: 25% for Sanguinare)
  const SILVER = /silver hand|vigilant|dawnguard|stendarr/i;
  const inBeast = (f) => (f?.pw?.beast || 0) > 0;
  const inLord = (f) => (f?.pw?.lord || 0) > 0;
  const inForm = (f) => inBeast(f) || inLord(f);
  const form = (f) => (inBeast(f) ? "wolf" : inLord(f) ? "lord" : null);
  const formT = (f) => (inBeast(f) ? f.pw.beast : inLord(f) ? f.pw.lord : 0);
  const bpf = (f) => (f.bp = f.bp || { used: {}, cdAt: {}, round: 0 });
  const tags = (f) => f.tags || new Set(f.e?.tags || []);
  const person = (f) => { const t = tags(f); return t.has("humanoid") && !t.has("undead") && !t.has("construct") && !t.has("dragon"); };
  const calmable = (f) => { const t = tags(f); return !t.has("boss") && !t.has("dragon") && !t.has("elite"); };
  const ehpMax = (f) => Math.max(1, f._ehpMax || f.ehp0 || f.e?.health || 1);
  const stage = (s) => (s.vampire && typeof CURSE !== "undefined" ? CURSE.stage(s) : 0);
  const silverFoe = (f) => SILVER.test(f.e?.name || "") || tags(f).has("silver");
  const sunOut = (f) => !!f.s?.vampire && typeof G !== "undefined" && !G.isNight(f.t ?? G.now()) && !f.s.dungeon && !f.e?.indoor && !f.arena;
  const curseRes = (s) => (typeof PFX !== "undefined" ? Math.min(0.75, PFX.num(s, "curseres")) : 0);
  const immune = (s) => typeof PRIESTS !== "undefined" && PRIESTS.immune && PRIESTS.immune(s);

  // ---------------------------------------------------------------- the moves
  /* w: how heavy the move is (sets its stamina or health price, see cost below) · sp: stamina the engine takes ·
     cd: rounds between uses · once: once per change (forms) or per fight (vampire)
     zone: where the move is dragged (tbui.js) */
  const MOVES = {
    "beast:claw": { w: 2, name: "Claws", icon: "", zone: "foe", desc: "Rake the foe with your claws." },
    "beast:maul": { w: 4, sp: 25, name: "Maul", icon: "", zone: "foe", desc: "A savage double swipe. Costs stamina; can knock the foe off balance." },
    "beast:pounce": { w: 3, cd: 3, name: "Pounce", icon: "", zone: "foe", desc: "Leap on the foe: a hard blow that can stagger it (half the time; bosses less). Every 3 rounds." },
    "beast:howl": { w: 3, once: true, name: "Howl", icon: "", zone: "foe", desc: "Ordinary foes cower for 2 turns; tough ones are shaken and hit 20% softer for 3 turns. Once per change." },
    "beast:feast": { w: 4, once: true, name: "Feast", icon: "", zone: "foe", desc: "Tear into a beaten person (below 35% health) and heal from it. Once per change." },
    "beast:revert": { w: 1, name: "Change back", icon: "", zone: "self", desc: "Force the wolf back down. You're spent for a couple of rounds." },
    "lord:claw": { w: 3, name: "Claws", icon: "", zone: "foe", desc: "Slash with a Vampire Lord's long claws." },
    "lord:drain": { w: 3, name: "Drain Life", icon: "", zone: "foe", desc: "Pull the life out of the foe and into you." },
    "lord:grip": { w: 4, cd: 3, name: "Vampiric Grip", icon: "", zone: "foe", desc: "Lift the foe by the throat: some damage and it's staggered. Every 3 rounds." },
    "lord:raise": { w: 4, once: true, name: "Raise Dead", icon: "", zone: "self", desc: "A corpse claws its way up to fight for you for 6 turns. Once per change." },
    "lord:revert": { w: 1, name: "Change back", icon: "", zone: "self", desc: "Fold your wings and change back." },
    "vamp:seduce": { w: 2, once: true, name: "Seduction", icon: "", zone: "foe", desc: "An ordinary person or beast lowers its guard and stops fighting for 3 turns. Once a fight." },
    "vamp:shadows": { w: 3, once: true, minStage: 3, name: "Embrace of Shadows", icon: "", zone: "self", desc: "Hunger stage 3+: melt into the dark. Nothing touches you for 2 turns and your next blow is a sneak attack. Once a fight." },
    "vamp:bite": { w: 3, once: true, name: "Bite", icon: "", zone: "foe", desc: "Sink your teeth into a beaten person (below 30% health): you feed, heal and your hunger resets. Once a fight." },
  };
  const isMove = (a) => !!MOVES[a];
  /* what a move costs: the wolf pays in stamina, the Vampire Lord's dark moves and a vampire's powers in health
     ({ sp, hp, eng }: eng is the stamina the engine itself takes for Maul) */
  function priceOf(f, a) {
    const m = MOVES[a]; if (!m) return null;
    if (/revert$/.test(a)) return { sp: 0, hp: 0 };
    let w = m.w;
    if (a === "beast:howl" && R(f.s, "wolf", "blood_howl")) w *= 0.5;   // Howl of the Pack
    if (a === "lord:drain" && R(f.s, "lord", "blood_magic")) w *= 0.5;   // Blood Magic
    if (a === "beast:maul") return { sp: m.sp, eng: { sp: m.sp } };
    if (a.startsWith("beast:") || a === "lord:claw") return { sp: 8 * w };   // in line with a weapon blow (tbfight ATK_SP)
    const mh = typeof G !== "undefined" && G.maxHealth ? G.maxHealth(f.s) : 100;
    return { hp: mh * (a.startsWith("lord:") ? 0.015 : 0.01) * w };
  }
  /* cost for tbfight.js: our moves, and Attack / Power attack turned into claws while you're changed */
  function cost(f, a) {
    if (isMove(a)) return priceOf(f, a);
    if (inBeast(f) && a === "attack") return priceOf(f, "beast:claw");
    if (inBeast(f) && a === "power_attack") return priceOf(f, "beast:maul");
    if (inLord(f) && a === "attack") return priceOf(f, "lord:claw");
    return null;
  }
  function canMove(f, a) {
    const m = MOVES[a]; if (!m) return false;
    const [k] = a.split(":"), s = f.s, b = bpf(f);
    if (k === "beast" && !inBeast(f)) return false;
    if (k === "lord" && !inLord(f)) return false;
    if (k === "vamp" && (!s.vampire || inForm(f))) return false;
    if (m.once && b.used[a]) return false;
    if (m.cd && b.cdAt[a] != null && b.round - b.cdAt[a] < m.cd) return false;
    if (m.sp && f.sp < m.sp) return false;
    if (m.minStage && stage(s) < m.minStage) return false;
    if (a === "beast:feast") return f.ehp < 0.35 * ehpMax(f) && f.ehp > 0 && (person(f) || (tags(f).has("beast") && R(s, "wolf", "savage_feeding") > 0));
    if (a === "vamp:bite") return person(f) && f.ehp > 0 && f.ehp < 0.3 * ehpMax(f);
    if (a === "vamp:seduce") { const t = tags(f); return calmable(f) && (t.has("humanoid") || t.has("beast")) && !t.has("undead") && !t.has("construct") && !t.has("daedra") && !(f.e?.player); }
    return true;
  }

  // ---------------------------------------------------------------- claws: a real blow through the engine's attack
  /* what a claw hits for before the move's multiplier: a beast's strength grows with you, or your weapon if it's better */
  function clawBase(f) {
    const s = f.s, lv = s.level || 1;
    const sk = Math.max(G.skill(s, "Hand-to-Hand") || 0, G.skill(s, "One-Handed") || 0, G.skill(s, "Two-Handed") || 0);
    let w = 0; try { w = f._clawDmg == null ? f.weaponDamage() : 0; } catch (e) { w = 0; }
    return Math.max(3 + 0.3 * lv + 0.03 * sk, w * 0.9);   // about a good steel blade at level 20; weaponDamage already counts skill
  }
  function strike(f, power, mult, label) {
    const keep = { weapon: f.weapon, wt: f.wt, off: f.off, bound: f.bound, paCost: f.paCost, mount: f.mount, temper: f.temper }, poison = f.s.poison;
    const base = clawBase(f) * mult;
    f._clawDmg = base; f.weapon = null; f.wt = "claw"; f.off = null; f.bound = null; f.mount = null; f.temper = 0; f.s.poison = null; f.paCost = MOVES["beast:maul"].sp;
    let r;
    try { r = String(f.attack(!!power)); } finally { Object.assign(f, keep); f.s.poison = poison; f._clawDmg = null; }
    return r.replace(/^(Power attack|Attack)/, label);
  }
  const landed = (t) => !/misses|dodges/.test(t);
  function rend(f, t) {   // Rending Claws: the wound keeps bleeding
    if (!inBeast(f) || !R(f.s, "wolf", "rending_claws") || !landed(t)) return "";
    f.bleed = f.bleed || []; f.bleed.push({ dmg: 3 + 0.25 * (f.s.level || 1), turns: 3 }); return ", it bleeds";
  }
  const lordHeal = (f) => 0.4 * (R(f.s, "lord", "blood_healing") ? 1.5 : 1);

  /* play one of our moves (from G.Fight.act) */
  function doMove(f, a) {
    const s = f.s, b = bpf(f), m = MOVES[a], mh = G.maxHealth(s), lv = s.level || 1;
    if (m.once) b.used[a] = true;
    if (m.cd) b.cdAt[a] = b.round;
    switch (a) {
      case "beast:claw": { const t = strike(f, false, 0.65, "Claws"); return t + rend(f, t); }
      case "beast:maul": {
        let t = strike(f, true, 0.75, "Maul");
        if (landed(t) && !f.stagger && !tags(f).has("dragon") && Math.random() < 0.1) { f.stagger = true; t += ", staggers"; }
        return t + rend(f, t);
      }
      case "beast:pounce": {
        let t = strike(f, false, 0.9, "Pounce");
        if (landed(t) && !tags(f).has("dragon") && Math.random() < (tags(f).has("boss") ? 0.25 : 0.5)) { f.stagger = true; if (!/stagger/.test(t)) t += ", staggers"; }
        return t + rend(f, t);
      }
      case "beast:howl": {
        const tough = !calmable(f), deep = R(s, "wolf", "blood_howl") > 0;
        if (!tough) { f.calmTurns = Math.max(f.calmTurns || 0, 2); return "Howl: the foe cowers"; }
        f.shaken = Math.max(f.shaken || 0, 3);
        if (deep && !tags(f).has("boss") && !tags(f).has("dragon")) { f.calmTurns = Math.max(f.calmTurns || 0, 1); return "Howl: the foe is shaken and cowers"; }
        return "Howl: the foe is shaken (hits 20% softer)";
      }
      case "beast:feast": {
        const e0 = f.ehp, t = strike(f, false, 1, "Feast"), d = Math.max(0, e0 - f.ehp);
        if (!landed(t)) return t;
        const h = d * (R(s, "wolf", "gorging") ? 0.9 : 0.6) + mh * 0.05, hb = f.hp; f.hp = Math.min(mh * 1.5, f.hp + h);
        return `${t} · you feed on it (+${Math.round(f.hp - hb)} health)`;
      }
      case "beast:revert": f.pw.beast = 0; tire(f); return "You force the wolf back down and change back";
      case "lord:claw": return strike(f, false, 0.75, "Claws");
      case "lord:drain": {
        const d = CURSE.drainOf(f) * 1.6 * (R(s, "lord", "blood_magic") ? 1.2 : 1), hb = f.hp;
        f.ehp -= d; f.hp = Math.min(mh * 1.3, f.hp + d * lordHeal(f));
        return `Drain Life: ${Math.round(d)} (+${Math.round(f.hp - hb)} health)`;
      }
      case "lord:grip": {
        const d = CURSE.drainOf(f); f.ehp -= d;
        if (!tags(f).has("dragon")) { f.stagger = true; return `Vampiric Grip: ${Math.round(d)}, staggers`; }
        return `Vampiric Grip: ${Math.round(d)}`;
      }
      case "lord:raise": {
        const n = R(s, "lord", "grave_servants") ? 2 : 1, dmg = 5 + 0.6 * lv;
        for (let i = 0; i < n; i++) f.allies.push({ name: "Risen thrall", dmg, kind: "zombie", thrall: true, left: 6, hp: 40 + 3 * lv, maxHp: 40 + 3 * lv, init: 5 });
        return n > 1 ? "Raise Dead: two corpses claw their way up to fight for you" : "Raise Dead: a corpse claws its way up to fight for you";
      }
      case "lord:revert": f.pw.lord = 0; return "You fold your wings and change back";
      case "vamp:seduce": f.calmTurns = Math.max(f.calmTurns || 0, 3); G.useSkill && G.useSkill(s, "Illusion", 15); return `Seduction: the ${f.e?.name || "foe"} lowers its guard`;
      case "vamp:shadows": f.pw.ether = Math.max(f.pw.ether || 0, 2); f.sneakNext = true; return "Embrace of Shadows: you melt into the dark";
      case "vamp:bite": {
        const d = 8 + 0.8 * lv, hb = f.hp; f.ehp -= d; f.hp = Math.min(mh, f.hp + 2 * d);
        if (s.vampire) s.vampire.fedAt = f.t ?? nowS(); f.bpFed = true;
        return `Bite: ${Math.round(d)} (+${Math.round(f.hp - hb)} health) · you feed, your hunger fades`;
      }
    }
    return "Nothing happens";
  }
  /* Beast Form leaves you spent: 25% weaker blows and little stamina for 2 rounds (not with Endless Hunt) */
  function tire(f) {
    if (R(f.s, "wolf", "endless_hunt")) return;
    f.bpTired = 2; f.sp = Math.min(f.sp, G.maxStamina(f.s) * 0.3);
  }

  // ---------------------------------------------------------------- the fight engine
  function hookFight() {
    const P = G.Fight.prototype;
    const act0 = P.act, aff0 = P.affordable, wd0 = P.weaponDamage;
    P.weaponDamage = function () { return this._clawDmg != null ? this._clawDmg : wd0.call(this); };
    P.act = function (a) {
      if (this._tb && this.pw) {   // turn-by-turn: your weapon hand is a claw while you're changed
        if (inBeast(this) && a === "attack") a = "beast:claw";
        else if (inBeast(this) && a === "power_attack") a = canMove(this, "beast:maul") ? "beast:maul" : "beast:claw";
        else if (inLord(this) && (a === "attack" || a === "power_attack")) a = "lord:claw";
      }
      if (isMove(a)) return canMove(this, a) ? doMove(this, a) : inBeast(this) ? doMove(this, "beast:claw") : inLord(this) ? doMove(this, "lord:claw") : act0.call(this, "attack");
      return act0.call(this, a);
    };
    P.affordable = function (a) {
      if (isMove(a)) return canMove(this, a);
      if (inForm(this)) {
        const k = a.split(":")[0];
        if (k === "spell" || k === "dual" || k === "scroll" || k === "shout" || k === "potion") return false;   // no spells, scrolls, shouts or potions while changed
        if (k === "power" && a !== "power:beast" && a !== "power:lord") return false;
        if (a === "block" && inBeast(this)) return false;   // a wolf doesn't raise a guard
        if (a === "power_attack" && this._tb) return inBeast(this) ? canMove(this, "beast:maul") : false;
      }
      return aff0.call(this, a);
    };
  }
  const TB_BEAST_OUT = 1.2, TB_BEAST_IN = 0.8;   // Beast Form in turn-by-turn fights: hits 20% harder, takes 20% less (balance: test_beastpaths.js)
  function hookCurse() {
    const C = CURSE;
    const dm0 = C.dmgMult, di0 = C.dmgInMult, tick0 = C.tick, tr0 = C.transform, lf0 = C.lordForm, after0 = C.after, mi0 = C.maybeInfect, cd0 = C.cureDisease, up0 = C.update, fx0 = C.fx;
    C.dmgMult = (f) => {
      let m = dm0(f);
      if (f._tb && inBeast(f)) m *= TB_BEAST_OUT / 1.8;   // turn by turn the claws already hit more often: the old 1.8x from the auto fights would end tough fights in 3 rounds
      if (f.bpTired > 0) m *= 0.75;
      if (sunOut(f) && stage(f.s) >= 4 && !R(f.s, "lord", "sun_ward")) m *= 0.9;   // starving in daylight
      return m;
    };
    C.dmgInMult = (f) => {
      let m = di0(f);
      if (f._tb && inBeast(f)) m *= TB_BEAST_IN / 0.55;
      if (silverFoe(f)) { if (inBeast(f) && !R(f.s, "wolf", "silver_hide")) m *= 1.3; else if (inLord(f)) m *= 1.25; }
      if (f.shaken > 0) m *= 0.8;
      return m;
    };
    C.tick = (f, line) => {
      const p = f.pw || {}, s = f.s, b = bpf(f);
      if (f.bpTired > 0) f.bpTired--;
      tick0(f, line);
      b.round++;
      if (f.shaken > 0) f.shaken--;
      if (p.beast === 1) { tire(f); if (f.bpTired) line.me += " · you're spent"; }
      if (sunOut(f) && !R(s, "lord", "sun_ward") && f.hp > 1) {   // the sun burns a vampire who fights outdoors by day
        const loss = Math.min(f.hp - 1, G.maxHealth(s) * 0.015 * stage(s));
        if (loss >= 1) { f.hp -= loss; line.me += ` · the sun burns you ${Math.round(loss)}`; }
      }
    };
    C.transform = (f) => {
      const hp0 = f.hp, t = tr0(f), b = bpf(f);
      if (f._tb) { const mh = G.maxHealth(f.s), vig = C.rank ? C.rank(f.s, "wolf", "animal_vigor") : 0; f.hp = Math.max(hp0, Math.min(mh * (vig ? 1.15 : 1), hp0 + mh * (vig ? 0.35 : 0.25))); }   // turn by turn: the change heals a quarter, no big overheal (the whole fight fits in one change)
      for (const k of Object.keys(b.used)) if (k.startsWith("beast:")) delete b.used[k];
      f.bpTired = 0;
      if (R(f.s, "wolf", "endless_hunt")) f.pw.beast += 3;
      return t + witnessed(f, "wolf");
    };
    C.lordForm = (f) => {
      const t = lf0(f), b = bpf(f);
      for (const k of Object.keys(b.used)) if (k.startsWith("lord:")) delete b.used[k];
      return t + witnessed(f, "lord");
    };
    C.after = (f) => {
      const out = after0(f) || [];
      const m = moonBite(f.s, f.e, f.t); if (m) out.push(m);
      return out;
    };
    C.maybeInfect = (s, enemy, t) => {
      if (curseRes(s) > 0 && Math.random() < curseRes(s)) return null;   // Wolfsbane
      return mi0(s, enemy, t);
    };
    C.cureDisease = (s) => {
      const r = cd0(s);
      if (s.moonblood) { s.moonblood = null; return (r ? r + " " : "") + "The fever of the bite breaks. The moon has no hold on you."; }
      return r;
    };
    C.update = (s, t = nowS()) => {
      const r = up0(s, t);
      if (r) return r;
      if (s.moonblood && (s.vampire || s.werewolf)) { s.moonblood = null; return null; }
      if (s.moonblood && t - s.moonblood.at >= C.TURN_AFTER) {
        s.moonblood = null; s.werewolf = { since: t, wild: true }; s.wolfDeclined = false;
        return " The moon pulls at your bones. You wake in the woods with blood on your hands: you are a werewolf now. Beast Form is in your fights, once a day. See the Hero tab.";
      }
      return null;
    };
    C.fx = (s, key, t = nowS()) => {
      const v = fx0(s, key, t);
      if (key === "regen:health" && v < 0 && R(s, "lord", "sun_ward")) return v / 2;   // Sun Ward halves the daylight penalty
      return v;
    };
  }
  /* changing where people can see you: townsfolk talk (dearer prices in that hold for a day) */
  function witnessed(f, kind) {
    const s = f.s;
    if (!s.location || s.dungeon || f.arena || typeof WORLD === "undefined" || !WORLD.places?.[s.location]) return "";
    if (typeof TOWNS !== "undefined" && TOWNS.isTown && !TOWNS.isTown(s.location)) return "";
    let hold = ""; try { hold = G.holdAt(WORLD.places[s.location]); } catch (e) { return ""; }
    s.bpSeen = s.bpSeen || {}; s.bpSeen[hold] = { t: f.t ?? nowS(), kind };
    return " · townsfolk scream and scatter";
  }
  /* a werewolf's bite: Moonblood */
  function moonBite(s, e, t = nowS()) {
    if (!e || !/werewolf/i.test(e.name || "") || s.werewolf || s.vampire || s.moonblood || s.sanguinare || immune(s)) return null;
    if (Math.random() >= BITE * (1 - curseRes(s))) return null;
    s.moonblood = { at: t };
    return " The werewolf's bite burns and won't close. (Moonblood: cure it within 3 in-game days with a Cure Disease potion or at a shrine, or you'll change at the next moon.)";
  }

  // ---------------------------------------------------------------- the turn-by-turn screen and the party
  /* buttons on the fight screen: while changed, your form's moves replace the weapon ones; otherwise the changes
     and a vampire's powers sit beside the shouts */
  function moves(f) {
    if (inBeast(f)) return { form: "wolf", left: f.pw.beast, list: ["beast:claw", "beast:maul", "beast:pounce", "beast:howl", "beast:feast", "beast:revert"].map((a) => [a, MOVES[a].name]) };
    if (inLord(f)) return { form: "lord", left: f.pw.lord, list: ["lord:claw", "lord:drain", "lord:grip", "lord:raise", "lord:revert"].map((a) => [a, MOVES[a].name]) };
    const out = [];
    try { if (f.affordable("power:beast")) out.push(["power:beast", "Beast Form"]); } catch (e) { /* not a wolf */ }
    try { if (f.affordable("power:lord")) out.push(["power:lord", "Vampire Lord"]); } catch (e) { /* not a vampire */ }
    if (f.s.vampire) for (const a of ["vamp:seduce", "vamp:shadows", "vamp:bite"]) if (canMove(f, a)) out.push([a, MOVES[a].name]);
    return { form: null, list: out };
  }
  /* why a form's move is greyed out, for the action bar (fightctl.js) */
  function why(f, a) {
    const m = MOVES[a]; if (!m) return "";
    const b = bpf(f), wait = m.cd && b.cdAt[a] != null ? m.cd - (b.round - b.cdAt[a]) : 0;
    if (m.once && b.used[a]) return a.startsWith("vamp:") ? "Once a fight" : "Once per change";
    if (wait > 0) return `Ready in ${wait} round${wait === 1 ? "" : "s"}`;
    if (m.sp && f.sp < m.sp) return "Not enough stamina";
    if (m.minStage && stage(f.s) < m.minStage) return "Not hungry enough";
    if (a === "beast:feast" || a === "vamp:bite") return "Wear it down first";
    if (a === "vamp:seduce") return "It won't listen";
    return "";
  }
  const ICONS = { "power:beast": "", "power:lord": "" };
  function icon(f, a) {
    if (MOVES[a]) return MOVES[a].icon;
    if (ICONS[a]) return ICONS[a];
    if (inForm(f) && (a === "attack" || a === "power_attack")) return inBeast(f) ? (a === "attack" ? "" : "") : "";
    return null;
  }
  const zone = (a) => (MOVES[a] ? MOVES[a].zone : null);
  function tip(f, a, c) {
    const m = MOVES[a]; if (!m) return null;
    const pr = c && typeof c === "object" ? c : priceOf(f, a);
    const t = typeof TB !== "undefined" && TB.costTxt ? TB.costTxt({ sp: Math.round(pr?.sp || 0), mp: 0, hp: Math.round(pr?.hp || 0) }) : "";
    return `${m.name}: ${m.desc}${t ? ` Costs ${t}.` : ""}`;
  }
  /* Smart AI while changed: feast when it can, open with a howl, pounce on cooldown, maul with stamina, claws otherwise */
  function aiMove(f) {
    if (inBeast(f)) for (const a of ["beast:feast", "beast:howl", "beast:pounce", "beast:maul", "beast:claw"]) if (canMove(f, a) && (a !== "beast:howl" || f.ehp > 0.5 * ehpMax(f))) return a;
    if (inLord(f)) {
      const mh = G.maxHealth(f.s);
      if (canMove(f, "lord:raise") && bpf(f).round <= 2) return "lord:raise";
      if (canMove(f, "lord:grip")) return "lord:grip";
      return f.hp < mh * 0.6 ? "lord:drain" : "lord:claw";
    }
    if (f.s.vampire) {
      if (canMove(f, "vamp:bite")) return "vamp:bite";
      if (canMove(f, "vamp:shadows") && f.hp < G.maxHealth(f.s) * 0.35) return "vamp:shadows";
    }
    return null;
  }
  function hookTB() {
    if (typeof TB === "undefined") return;
    const S = TB.Session.prototype, act0 = S.act, can0 = S.canAfford, ar0 = S.applyRemote, er0 = S.endRound, fa0 = S.foeAct;
    S.act = function (...a) { this.f._tb = true; this.f._ehpMax = this.ehpMax; return act0.apply(this, a); };
    S.canAfford = function (a) { this.f._tb = true; this.f._ehpMax = this.ehpMax; return can0.call(this, a); };
    /* a teammate's form comes back with their turn; it runs down with the rounds on the leader's phone */
    S.applyRemote = function (al, r) {
      ar0.call(this, al, r);
      if (al && r && r.self) { al.form = r.self.form || null; al.formT = r.self.form ? Math.max(1, r.self.formT | 0) : 0; }
    };
    S.endRound = function () {
      er0.call(this);
      for (const al of [...(this.everyone || []), ...this.f.allies]) if (al && al.form && al.formT > 0 && --al.formT <= 0) al.form = null;
    };
    /* a changed teammate shrugs off blows like you do: a wolf 40%, a Lord 20% */
    S.foeAct = function (prefix) {
      const ch = this.f.allies.filter((a) => a.form);
      ch.forEach((a) => { a._bpRed = a.red; a.red = Math.min(0.85, (a.red || 0) + (a.form === "wolf" ? 0.4 : 0.2)); });
      try { return fa0.call(this, prefix); } finally { ch.forEach((a) => { a.red = a._bpRed; delete a._bpRed; }); }
    };
    if (!TB.BUFF_KEYS.includes("form")) TB.BUFF_KEYS.push("form");   // so every phone's roster carries who is changed
    if (!TB.FOE_KEYS.includes("shaken")) TB.FOE_KEYS.push("shaken");
    if (typeof SHAREDFIGHT !== "undefined" && SHAREDFIGHT.Mirror) {
      const M = SHAREDFIGHT.Mirror.prototype, rp0 = M.reply, sy0 = M.sync;
      M.reply = function () { const r = rp0.call(this); r.self = { ...(r.self || {}), form: form(this.f), formT: formT(this.f) }; return r; };
      /* the leader's phone runs the rounds: on a teammate's own phone the form still runs down once a round */
      M.sync = function (d) {
        const r0 = this.lastRound || 0; sy0.call(this, d);
        const f = this.f;
        if (r0 && this.lastRound > r0 && f.pw) {
          if (f.bpTired > 0) f.bpTired--;
          if (f.pw.beast === 1) tire(f);
          for (const k of ["beast", "lord", "ether"]) if (f.pw[k] > 0) f.pw[k]--;
          bpf(f).round++;
        }
      };
    }
  }
  function hookAI() {
    if (typeof COMBATAI !== "undefined" && COMBATAI.decide) {
      const d0 = COMBATAI.decide;
      COMBATAI.decide = (f, actor = "player", settings = null) => {
        if (!(actor && typeof actor === "object") && f && f.pw) { const a = aiMove(f); if (a) return { action: a, rule: 0, why: inForm(f) ? "fights like the beast it is" : "the hunger decides" }; }
        return d0(f, actor, settings);
      };
    }
    if (typeof TBTIPS !== "undefined" && TBTIPS.action) {
      const t0 = TBTIPS.action;
      TBTIPS.action = (f, a, c) => tip(f, a, c) || (inForm(f) && (a === "attack" || a === "power_attack") ? tip(f, inBeast(f) ? (a === "attack" ? "beast:claw" : "beast:maul") : "lord:claw", c) : null) || t0(f, a, c);
    }
  }

  // ---------------------------------------------------------------- the road: a wild werewolf, the Ashen Court
  function werewolfFoe(s) {
    const L = Math.max(8, s.level || 1);
    return { name: "Werewolf", danger: "high", level: L, tags: ["beast", "elite", "nightkin"], health: Math.round(100 + 8 * L), damage: Math.round(10 + 0.8 * L), gold: [0, 0], holds: null,
      text: "A hunched shape on two legs, eyes like lamps. It howls, and the forest goes quiet." };
  }
  function courtFoe(s) {
    const L = Math.max(12, (s.level || 1) + 2);
    return { name: "Vampire of the Ashen Court", danger: "high", level: L, tags: ["undead", "humanoid", "elite", "nightkin"], health: Math.round(110 + 9 * L), damage: Math.round(12 + 0.9 * L), gold: [60, 160], holds: null,
      text: "The noble's smile shows every tooth. Shadows pour out of the carriage." };
  }
  function hookRoad() {
    if (typeof ENC === "undefined" || !ENC.L) return;
    const pct = (p) => `${Math.round(clamp(p, 0, 1) * 100)}%`;
    const defs = [
      { id: "moonhunt", title: "A howl under the moon", weight: 2, minLv: 8,
        when: (s, c) => c.night && !c.sol,
        make: (s) => ({ kin: !!s.werewolf, text: s.werewolf ? "A howl rolls over the trees, and the blood in you answers. Something big is hunting nearby, and it smells you too." : "A howl rolls over the trees, far too close. Branches snap. Something on two legs is running towards you, and it isn't a man any more." }),
        choices: (e, s) => e.kin ? [["howl", " Howl back"], ["fight", " Fight it for the hunt"], ["leave", "Walk on"]]
          : [["fight", " Stand and fight"], ["hide", ` Hide in the brush (${pct(ENC.sneakCh(s, 0.15))})`], ["leave", "Run for the road"]],
        fight: (s) => ({ text: "It bursts out of the dark, all teeth and claws.", foe: werewolfFoe(s), after: "wolfLoot" }),
        hide: (s) => { const win = Math.random() < ENC.sneakCh(s, 0.15), sk = G.useSkill(s, "Sneak", win ? 15 : 5);
          return win ? { text: "You press flat in the ferns. It sniffs the air a long while, then lopes off after a deer.", skills: sk } : { text: "It smells you. It's on you before you can stand.", foe: werewolfFoe(s), enemyFirst: true, skills: sk }; },
        howl: (s) => { const b = (s.beastPerks = s.beastPerks || { wolf: {}, lord: {}, feeds: 0, kills: 0 }); b.feeds++; G.setHealth(s, G.maxHealth(s));
          return { text: "You howl back. A great grey werewolf steps out, sniffs you and lets you share its kill. (You feed: health restored, +1 toward werewolf perks.)" }; },
        wolfLoot: (s) => { const id = ["pelt_wolf"].find((x) => D.ITEMS[x]); if (id) G.give(s, id, 2); return `The werewolf shrinks back into a naked, dead man.${id ? ` You take 2 ${D.ITEMS[id].name}.` : ""}`; } },
      { id: "palecourt", title: "The Ashen Court", weight: 1.5, minLv: 12,
        when: (s, c) => c.night && !c.sol && !s.vampire,
        make: (s) => ({ wolf: !!s.werewolf, text: s.werewolf ? "A black carriage stops beside you. A pale noble wrinkles their nose. \"Dog. The Ashen Court has no use for your kind.\"" : "A black carriage with drawn curtains stops beside you. A pale noble leans out, eyes red as embers. \"You fight well. The Ashen Court could use someone like you. Take the gift, and the night is yours forever.\"" }),
        choices: (e) => e.wolf ? [["fight", " Answer the insult"], ["leave", "Let them go"]] : [["accept", " Accept the gift"], ["refuse", "Refuse politely"], ["fight", " Draw steel"]],
        accept: (s) => {
          if (s.werewolf || s.vampire) return { text: "\"Your blood is already spoken for.\" The carriage rolls on." };
          s.vampire = { since: nowS(), fedAt: nowS(), court: true }; s.sanguinare = null; s.moonblood = null;
          const b = (s.beastPerks = s.beastPerks || { wolf: {}, lord: {}, feeds: 0, kills: 0 }); b.kills = Math.max(b.kills, 2);
          return { text: "You climb in. Cold lips at your throat, a sting, then nothing. You wake by the roadside at dusk, starving and strong. You are a vampire now, and the Court gave you a taste of being a Vampire Lord (a perk point). See the Hero tab." };
        },
        refuse: () => ({ text: "\"A pity.\" The curtain falls. \"The Court is patient. We'll ask again.\"" }),
        fight: (s) => ({ text: "The noble steps down, smiling, and the coachman draws a curved blade.", foe: courtFoe(s), after: "courtLoot" }),
        courtLoot: (s) => { const g = Math.round(80 + 6 * (s.level || 1)); s.gold += g; const it = ["potion_cure_disease"].find((x) => D.ITEMS[x]); if (it) G.give(s, it, 1); return `In the carriage: ${g} gold${it ? " and a Potion of Cure Disease, kept for the servants" : ""}.`; } },
    ];
    for (const d of defs) if (!ENC.byId[d.id]) { ENC.L.push(d); ENC.byId[d.id] = d; }
  }
  /* vampires and werewolves are "nightkin" for Bane of the Night */
  function tagNightkin() {
    if (typeof D === "undefined" || !D.ENCOUNTERS) return;
    for (const e of D.ENCOUNTERS) if (/vampire|werewolf/i.test(e.name || "") && !(e.tags || []).includes("nightkin")) e.tags = [...(e.tags || []), "nightkin"];
  }

  // ---------------------------------------------------------------- new perk stars (curses.js trees; old ids kept)
  const STARS = {
    wolf: [
      ["rending_claws", "Rending Claws", 1, ["bestial_strength"], 50, 64, "Your claws, mauls and pounces leave wounds that bleed for 3 turns."],
      ["blood_howl", "Howl of the Pack", 1, ["totem_terror"], 38, 42, "Howl costs half the stamina, and even tough foes cower for a turn."],
      ["silver_hide", "Silver Hide", 1, ["animal_vigor"], 62, 46, "Silver weapons no longer hurt you more in Beast Form."],
      ["endless_hunt", "Endless Hunt", 1, ["savage_feeding"], 62, 10, "Beast Form lasts 3 rounds longer, and changing back no longer leaves you spent."],
    ],
    lord: [
      ["blood_magic", "Blood Magic", 1, ["detect_all"], 56, 60, "Drain Life costs half the health and drains 20% more."],
      ["grave_servants", "Grave Servants", 1, ["vampiric_grip"], 92, 72, "Raise Dead brings up two thralls instead of one."],
      ["sun_ward", "Sun Ward", 1, ["unearthly_will"], 28, 10, "The sun no longer burns you in fights, and slows your healing only half as much."],
    ],
  };
  function addStars() {
    if (typeof CURSE === "undefined") return;
    for (const tree of ["wolf", "lord"]) for (const p of STARS[tree]) if (!CURSE.TREES[tree].perks.some((x) => x[0] === p[0])) CURSE.TREES[tree].perks.push(p);
    for (const n of [54, 62, 70, 80]) if (!CURSE.NEED.includes(n)) CURSE.NEED.push(n);
  }

  // ---------------------------------------------------------------- townsfolk
  /* a shop's prices for you: a hungry vampire looks ill, a werewolf seen changing here is talked about */
  function priceMult(s, town) {
    let m = 1;
    const st = stage(s);
    if (st >= 4) m = Math.max(m, 1.35); else if (st >= 3) m = Math.max(m, 1.15);
    const seen = seenIn(s, town); if (seen) m = Math.max(m, 1.25);
    return m;
  }
  function seenIn(s, town) {
    if (!s.bpSeen || typeof WORLD === "undefined" || !WORLD.places?.[town]) return null;
    let hold = ""; try { hold = G.holdAt(WORLD.places[town]); } catch (e) { return null; }
    const x = s.bpSeen[hold]; return x && nowS() - x.t < CURSE.DAY ? x : null;
  }
  /* starving (stage 4): merchants bar the door */
  const refuse = (s) => (stage(s) >= 4 ? "The merchant takes one look at your sunken face and bars the door. (Hunger stage 4: feed at an inn first.)" : null);
  const VAMP_BARKS = {
    1: ["Your eyes... are you feeling alright?", "Stay out of the sun much? You look pale."],
    2: ["You look half-starved, friend. Eat something.", "Gods, your skin's like milk. Are you sick?"],
    3: ["Keep away from me. Your eyes are... wrong.", "Guards! There's something wrong with that one!", "Why are you staring at my neck?"],
    4: ["Monster! Get away! Get away!", "Stendarr protect me, it's one of them!", "Lock the doors, the pale thing is back!"],
  };
  const WOLF_BARKS = ["Did you see it? A beast, right here in the street!", "They say a wolf on two legs was seen in town. I'm sleeping with an axe.", "Keep your dogs inside tonight."];
  function hookTown() {
    if (typeof IMM === "undefined" || !IMM.bark || !IMM.BARKS) return;
    const b0 = IMM.bark, B = IMM.BARKS;
    IMM.bark = (s, place, t) => {
      const keepV = B.vampire ? B.vampire.slice() : null, keepAny = B.any ? B.any.length : 0;
      try {
        if (B.vampire && s?.vampire) { B.vampire.length = 0; B.vampire.push(...VAMP_BARKS[stage(s)] || VAMP_BARKS[1]); }
        if (B.any && s && seenIn(s, place)) B.any.push(...WOLF_BARKS, ...WOLF_BARKS);
        return b0(s, place, t);
      } finally { if (keepV) { B.vampire.length = 0; B.vampire.push(...keepV); } if (B.any) B.any.length = keepAny; }
    };
  }

  // ---------------------------------------------------------------- the Character tab (ui.js bloodPanel)
  const esc = (t) => String(t ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
  const row = (a, extra = "") => { const m = MOVES[a]; return `<div class="item bpmove"><div class="t">${m.icon} ${esc(m.name)}<span>${esc(m.desc)}${extra}</span></div><span class="num sub">${/revert$/.test(a) ? "free" : a.startsWith("beast:") || a === "lord:claw" ? "stamina" : "health"}</span></div>`; };
  function panelExtra(s, kind) {
    if (kind === "wolf") {
      const seen = s.bpSeen ? Object.entries(s.bpSeen).filter(([, x]) => nowS() - x.t < CURSE.DAY).map(([h]) => h) : [];
      return `<details class="bpx"><summary> Beast Form moves and drawbacks</summary>
        <p class="sub">In a turn-by-turn fight your hands are claws while you're changed. No spells, scrolls, shouts, potions or guard.</p>
        <div class="list">${["beast:claw", "beast:maul", "beast:pounce", "beast:howl", "beast:feast", "beast:revert"].map((a) => row(a)).join("")}</div>
        <p class="sub"> Silver (the Silver Hand, Vigilants, Dawnguard) hits you 30% harder in Beast Form. When the beast lets go you're spent for 2 rounds: weaker blows and little stamina.${s.werewolf?.wild ? " Your blood came from a wild werewolf's bite, not the Circle, but the cure is the same." : ""}</p>
        ${seen.length ? `<p class="sub"> People saw you change in ${esc(seen.join(", "))}. Shops there charge more until the talk dies down (a day).</p>` : ""}</details>`;
    }
    const st = stage(s), lines = [
      ["1", "Barely hungry. People say you look pale."],
      ["2", "Hungry. The sun burns 3% of your health a round in daytime fights outdoors."],
      ["3", "Ravenous. Shops charge 15% more. Embrace of Shadows wakes up. The sun burns 4.5% a round."],
      ["4", "Starving. Shops bar the door, townsfolk panic. In daylight your blows are 10% weaker and the sun burns 6% a round."],
    ];
    return `<details class="bpx"><summary> Hunger, powers and the Vampire Lord's moves</summary>
      <div class="list">${lines.map(([n, t]) => `<div class="item${+n === st ? " on" : ""}"><div class="t">Stage ${n}${+n === st ? " (now)" : ""}<span>${esc(t)}</span></div></div>`).join("")}</div>
      <p class="sub">Powers in a fight (not while changed):</p>
      <div class="list">${["vamp:seduce", "vamp:shadows", "vamp:bite"].map((a) => row(a)).join("")}</div>
      <p class="sub">As a Vampire Lord your hands are claws; no spells, scrolls, shouts or potions. Silver hits you 25% harder.</p>
      <div class="list">${["lord:claw", "lord:drain", "lord:grip", "lord:raise", "lord:revert"].map((a) => row(a)).join("")}</div></details>`;
  }
  function moonPanel(s) {
    if (!s.moonblood) return "";
    const left = Math.max(0, CURSE.TURN_AFTER - (nowS() - s.moonblood.at)), h = Math.floor(left / 3600), m = Math.ceil((left % 3600) / 60);
    return `<div class="panel" style="border-color:var(--gold)"><h2> Moonblood</h2><p class="sub">A werewolf's bite that won't heal. In about ${h ? `${h} h ` : ""}${m} min (${(left / CURSE.DAY).toFixed(1)} in-game days) you'll change for the first time and be a werewolf for good. Drink a Potion of Cure Disease or pray at a roadside shrine to stop it, or let the moon have you.</p></div>`;
  }

  // ---------------------------------------------------------------- wire it all up
  if (typeof G !== "undefined" && G.Fight) hookFight();
  if (typeof CURSE !== "undefined") { hookCurse(); addStars(); }
  hookTB(); hookAI(); hookRoad(); hookTown(); tagNightkin();

  return { MOVES, cost, canMove, doMove, moves, why, icon, zone, tip, aiMove, form, formT, inForm, inBeast, inLord, clawBase, priceMult, refuse, seenIn, moonBite, panelExtra, moonPanel,
    werewolfFoe, courtFoe, STARS, BITE, SILVER, sunOut, VAMP_BARKS };
})();
