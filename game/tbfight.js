/* Turn-based fights with initiative; every hero turn has 3 action points (AP). [OURS module]
   [Combat step 3, build 350] On your turn you have 3 AP. Each move costs AP and also stamina, magicka or health:
     1 AP  attack (a dual-wield attack is one blow plus the left hand's lighter follow-up), a bow shot, guard, shield
           bash, a minor spell (Novice / Apprentice: Flames, Frostbite, Healing...), a 1-2 word shout, a potion (one a
           turn), a scroll of a minor spell, a poison, Breathe (it ends your turn), Oil flask / Mark / Cover.
     2 AP  power attack (a dual-wield flurry when you hold two blades; a bow's fully drawn aimed shot), a major spell
           (Adept and up: Fireball, Close Wounds, cloaks, area spells), a dual cast, a full 3-word shout, a scroll of a
           major spell, a beast's or Vampire Lord's heaviest moves.
   AP you don't spend become guard when you end your turn: 10% less damage per AP, at most 30%, until your next turn.
   A move whose target is already gone when it lands costs nothing (sess.reserve holds the AP while a minigame runs).
   Followers have 2 AP for their orders (followerai.js); fast foes keep their two slots, with the foe's moves for the
   round shared out over them (initiative.js foeSlots), never 3 AP twice.
   Perks (perkfx.js): Heavy Momentum (a power attack for 1 AP once a fight), Spell Weaving (a major spell for 1 AP once
   a fight), Steady Guard (more guard per AP kept). The same move again in one turn still costs 50% more.
   History: build 145 removed the old action points ("everything costs stamina or mana or health"), then a turn held 4
   moves; build 350 brought back 3 AP a turn. The notes below are the original design, kept for history.
   Remigiusz: "Let's make fights really turn based; turn order should be initiative based. Followers and summons do their
   turns automatically." You play your own turns (with an Auto button); Athletics and Alteration make your moves cheaper,
   initiative is 1d4 + speed, rolled once a fight (initiative.js; heavy armour slows you); balanced so fights don't end quickly; party fights
   harder; in a party each player plays their own turns live.

   How it fits the engine: every fight in the game is still a G.Fight. The old instant `run()` is kept for sims, the arena
   and tests. In the app, TB.call(S, fn, done) runs a game action (road encounter, dungeon room, quest, raid...). When the
   action reaches `fight.run()`, the action is paused, the fight is played turn by turn on screen, and then the action is
   re-run from a snapshot with the same dice up to the fight, which now "finishes" instantly with the played result.
   So loot, death, quests and XP all go through the exact same code as before.

   Turn order (initiative.js, since build 347): everyone rolls 1d4 + speed once a fight; stuns, freezes, staggers, haste
   and slow move people in the order as the fight goes; heroes next to each other in the order act together (a shared
   turn). You pay stamina, magicka or health for moves (weapon blows, power attacks, guard, spells, shouts, potions,
   flee); AP you don't spend become guard. Followers, summons, thralls and party members act in their own slots; real
   players in your party play their own turn on their own phone (sharedfight.js; a shared turn has no timer: it waits for everyone, the leader can skip a player who's gone quiet).
   No one-shots: a single blow can't take more than 40% of a strong target's health, except a finishing blow.
   The AI is reached through one adapter, TB.aiPick(fight, actor), which uses COMBATAI.decide(fight, actor, settings)
   when another module provides it, otherwise the fight's own choice (Smart AI or your custom tactics). */
const TB = (() => {
  // ------------------------------------------------------------------ numbers (tuned with tests/sim_tbfight.js)
  const ATK_SP = { dagger: 12, fist: 10, claw: 16, sword: 18, axe: 20, mace: 20, spear: 18, staff: 16, greatsword: 26, battleaxe: 28, warhammer: 28, bow: 36, crossbow: 42 };   // stamina a plain blow takes (a full three-blow turn leaves you winded; about two a round keeps going)
  const AIM_SP = 2.5;   // [threeap] a fully drawn aimed shot costs at least this many plain shots' stamina (one big arrow beats armour better than two small ones)
  const SWINGS = { dagger: 3, fist: 3, claw: 2, sword: 2, axe: 2, mace: 2, spear: 2, staff: 2, greatsword: 1.5, battleaxe: 1.5, warhammer: 1.5, bow: 1.5, crossbow: 1.2 };   // a typical turn of plain blows (foe health is sized from it)
  const AP = 3, MAX_ACTS = AP, MAX_POTS = 1, REPEAT = 0.5, SHOUT_SP = 10, DARK_HP = 0.03;   // MAX_ACTS: AP's old name (other modules and tests read it)
  const GUARD_AP = 0.1, GUARD_MAX = 0.3;   // each AP you don't spend: 10% less damage until your next turn, at most 30%
  const BIG = new Set(["Adept", "Expert", "Master"]);   // spells of these levels are major spells: 2 AP
  const HIT_CAP = 0.4;          // max share of a strong target's health one blow can take
  /* foe toughness and actions per round, by kind of foe (tuned with the sim in tests/test_tbfight.js) */
  const T = { hp: { normal: 2.0, tough: 2.6, boss: 3.0 }, acts: { normal: 2.4, tough: 2.5, boss: 2.5 },
    rounds: { normal: 4, tough: 6, boss: 7 },   // how long a fight should roughly last (build 350, 3 AP: sims give medians of about 4-5 / 6 / 10-11 rounds)
    est: { k: 0.7, pool: 1, mk: 0.85, mix: 0.25, sum: 0.8 },   // [post-combat2] share of the damage your stamina / magicka pays for in a round that foe health is sized for
    min: { normal: 1, tough: 1.2, boss: 1.3 }, max: { normal: 7, tough: 9, boss: 10 },   // bounds on the health boost
    /* [partyboss] party fights (build 354): every teammate plays a full 3 AP turn on their own phone, so the foe is sized
       for what each of them really deals a round (COOP.profile publishes it: dprOf), not one plain blow each. On top of
       that a party foe gets a little more health (a party also heals, shields and covers each other: hp) and 0.6 more
       moves a round per extra player (acts); tuned with tests/test_partyboss.js: bosses take about 8-12 rounds and
       tough fights 5-8 at every party size 1-8, and the solo and 8-player win rates stay within 15 points */
    party: { hp: { normal: 0, tough: 0.25, boss: 0.2 }, acts: 0.6 } };
  const FOE_HP = T.hp.normal;
  const PARTY_HP = T.party.hp;  // extra foe health in a fight with real players, by kind of fight (shared out over the extra foes below)
  const MAX_FOES = 6;           // [OURS] a party meets one foe per hero, one after another (like dungeon rooms), at most 6; bosses stay alone
  const MAX_ROUNDS = 40;
  const MP_REGEN = 3.2, SP_REGEN = 4.4;   // per round about 22% of your stamina and 10% of your magicka come back (moves cost them now)
  const TURN_SECONDS = 0;   // [initiative] no timer on a shared turn any more (owner's call): it waits for everyone; the leader can skip a quiet player (INIT.CFG.skipAfter)
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sameJ = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const tr0 = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);

  /* your speed and how cheap your moves are (what the screen shows; the skill info texts quote these).
     Speed (initiative.js): 5, +1 in light armour, -1 in heavy, +0..+2 from perks and gear. It decides WHEN you act.
     Athletics and Battle Rhythm make weapon moves cheaper; Alteration and Quickened Casting make spells cheaper. */
  function stats(s, f) {
    const ath = G.skill(s, "Athletics"), alt = G.skill(s, "Alteration");
    const spCut = clamp(ath / 1000 + 0.1 * pfx(s, "tbap"), 0, 0.35), mpCut = clamp(alt / 1000 + 0.1 * pfx(s, "tbspap"), 0, 0.35);
    let heavy = 0, medium = 0;
    for (const a of Object.values(f?.armor || {})) { if (a.type === "heavy") heavy++; else if (a.type === "medium") medium++; }
    const sp = typeof INIT !== "undefined" ? INIT.heroSpeed(s, f) : { speed: 5, parts: [] };
    return { acts: MAX_ACTS, pots: MAX_POTS, spCut, mpCut, speed: sp.speed, speedParts: sp.parts, heavy };
  }
  /* [partyboss] what a hero deals in a round of a turn-based fight, worked out on their own phone from their own kit
     (the same guess a fight sizes its foe with, without followers: those come as their own cards). [normal, tough, boss].
     COOP.profile publishes it, so the leader's phone sizes a party's foe for what every teammate really deals. */
  const dprMemo = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function dprOf(s) {
    if (!s) return null;
    const key = [s.level, JSON.stringify(G.loadout(s)?.equipment || {}), (s.spells || []).length, Object.keys(s.perks || {}).length, Object.values(s.skills || {}).reduce((a, x) => a + (x.lvl || 0), 0)].join("|");
    const old = dprMemo && dprMemo.get(s); if (old && old.key === key) return old.v;
    let v = null;
    try {
      const f = new G.Fight(s, { name: "-", health: 100, hp: 100, damage: 0, tags: [], level: s.level }); f.allies = [];
      const st = stats(s, f);
      v = ["normal", "tough", "boss"].map((kind) => Math.max(0, Math.round(Session.prototype.estimate.call({ st, kind }, f) * 10) / 10));
    } catch (e) { v = null; }
    if (dprMemo) dprMemo.set(s, { key, v });
    return v;
  }
  const isMate = (a) => !!(a && a.player && !a.follower && a.kind !== "follower" && !a.summon);
  const mateDpr = (a, kind) => { const v = Array.isArray(a.dpr) ? a.dpr[{ normal: 0, tough: 1, boss: 2 }[kind] ?? 2] : +a.dpr; return v > 0 && Number.isFinite(v) ? Math.min(v, 5000) : 0; };
  const spellOf = (a) => { const [k, arg] = a.split(":"); return k === "spell" || k === "dual" ? D.SPELLS[arg] : k === "scroll" ? D.SPELLS[D.ITEMS[arg]?.spell] : null; };
  const tierOf = (id, sp) => sp?.level || (typeof TOMES !== "undefined" && TOMES.level ? TOMES.level(id) : "Novice");
  /* what a move takes before repeats: { sp, mp, hp, eng } (stamina, magicka, health; eng = the part the engine itself
     takes when the move runs: power attacks, guards, bashes, spells). Potions, scrolls, powers and fleeing are free. */
  function base(f, a) {
    if (typeof BEASTPATH !== "undefined") { const c = BEASTPATH.cost(f, a); if (c) return c; }   // claws and a changed form's own moves (beastpaths.js)
    if (typeof STRAT !== "undefined" && STRAT.owns(a)) return STRAT.cost(f, a);   // Catch your breath (strategy.js)
    if (typeof REACT !== "undefined" && REACT.owns(a)) return REACT.cost(f, a);   // Oil flask, Mark target, Cover allies (reactions.js)
    if (typeof MOUNTFIGHT !== "undefined" && MOUNTFIGHT.owns(a)) return MOUNTFIGHT.cost(f, a);   // getting on / off your horse (mountfight.js)
    const s = f.s, [k, arg] = a.split(":");
    if (a === "attack") return { sp: ATK_SP[f.wt] || 9 };
    if (a === "power_attack") {   // [threeap] a fully drawn aimed shot takes at least two shots' stamina (light bows made it cheaper than two arrows)
      const pa = f.wt === "bow" || f.wt === "crossbow" ? Math.max(f.paCost || 0, AIM_SP * (ATK_SP[f.wt] || 9)) : f.paCost || 0;
      return { sp: pa, eng: { sp: f.paCost || 0 } };
    }
    if (a === "block") { const c = F.BLOCK_STAMINA * Math.max(0, 1 - (typeof PFX !== "undefined" ? Math.min(1, PFX.sum(s, "blockcost", f, {})) : 0)); return { sp: c, eng: { sp: c } }; }
    if (a === "bash") { const c = typeof SHIELDFX !== "undefined" ? SHIELDFX.cost(f) : 35; return { sp: c, eng: { sp: c } }; }
    if (k === "spell" || k === "dual") {
      const sp = D.SPELLS[arg]; if (!sp) return {};
      const c = G.spellCost(s, sp) * (k === "dual" ? ((typeof MAGIC !== "undefined" && MAGIC.DUAL_COST) || 2) * (typeof MOUNTFIGHT !== "undefined" ? MOUNTFIGHT.dualMul(f) : 1) : 1);   // from the saddle a dual cast takes a little more (mountfight.js)
      const dark = sp.kind === "absorb" || sp.kind === "reanimate";   // dark magic takes a little blood too
      return { mp: c, hp: dark ? DARK_HP * G.maxHealth(s) : 0, eng: { mp: c } };
    }
    if (k === "shout") return { sp: SHOUT_SP };
    return {};
  }
  /* [threeap] how many of your 3 AP a move takes: { ap, perk } (perk: "pa" / "sp" when a once-a-fight perk makes it
     1 AP; it's used up when the move is paid). Heavy moves take 2: a power attack (a two-blade flurry, a fully drawn
     aimed shot), a major spell (Adept and up), a dual cast, a full 3-word shout, a beast's or Vampire Lord's heaviest moves. */
  const HEAVY_BEAST = new Set(["beast:maul", "beast:feast", "lord:grip", "lord:raise"]);
  function apOf(f, a, b) {
    if (a === "end" || a === "flee") return { ap: 0 };
    if (b && b.acts > 1) return { ap: b.acts };   // a module that sets its own price (getting on a horse: two)
    const [k, arg] = String(a).split(":"), s = f && f.s, used = (f && f.apPerk) || {};
    let ap = 1, kind = null;
    if (a === "power_attack") { ap = 2; kind = "pa"; }
    else if (HEAVY_BEAST.has(a)) ap = 2;
    else if (k === "dual") { ap = 2; kind = "sp"; }
    else if (k === "spell" || k === "scroll") { const sp = spellOf(a), sid = k === "scroll" ? D.ITEMS[arg]?.spell : arg; if (sp && BIG.has(tierOf(sid, sp))) { ap = 2; kind = k === "spell" ? "sp" : null; } }
    else if (k === "shout") { try { if (typeof POWERS !== "undefined" && POWERS.level && POWERS.level(s, arg) >= 3) ap = 2; } catch (e) { /* unknown shout: 1 AP */ } }
    if (ap === 2 && kind && s && !used[kind] && pfx(s, kind === "pa" ? "tbpa1" : "tbsp1") > 0) return { ap: 1, perk: kind };   // Heavy Momentum / Flowing Strikes / Quick Draw, Spell Weaving / Swift Mending
    return { ap };
  }
  /* guard from AP kept at the end of a turn (also the host's check on a teammate's word in sharedfight.js) */
  const guardFor = (s, kept) => { const k = clamp(kept || 0, 0, AP), x = s ? Math.min(0.1, 0.05 * k * pfx(s, "tbguard")) : 0; return clamp(GUARD_AP * k + x, 0, GUARD_MAX + x); };
  /* what a move costs you right now: { sp, mp, hp, n, acts } (n: times you already did it this turn, +50% each; acts: its AP) */
  function cost(f, a, sess) {
    if (a === "end" || a === "flee") return { sp: 0, mp: 0, hp: 0, n: 0, acts: 0 };
    const b = base(f, a), n = (sess && sess.used && sess.used[a]) || 0, m = 1 + REPEAT * n, st = (sess && sess.st) || {}, ap = apOf(f, a, b);
    return { sp: Math.round((b.sp || 0) * m * (1 - (st.spCut || 0))), mp: Math.round((b.mp || 0) * m * (1 - (st.mpCut || 0))), hp: Math.round((b.hp || 0) * m), n, eng: b.eng || null, acts: ap.ap, perk: ap.perk || null };
  }
  /* [movepreview] what a move will do before you make it: { lo, hi } damage to the foe (the low and high end of the
     dice), { heal } for you, plus its cost. The fight tooltips (tbtips.js) and the striped "could lose" piece on the
     foe's bar (movepreview.js) both read this one function, so the words and the bar always agree. It keeps the
     no-one-shot rule: one blow takes at most 40% of a strong foe's health unless it finishes it (capFoe below). */
  function preview(f, a, sess) {
    const out = { a, lo: 0, hi: 0, heal: 0, guard: 0, c: cost(f, a, sess) };
    if (!f) return out;
    if (a === "end") { out.guard = sess && sess.guardLeft ? sess.guardLeft() : 0; return out; }
    const [k, arg] = String(a).split(":"), [s0, s1] = typeof F !== "undefined" && F.DAMAGE_SPREAD ? F.DAMAGE_SPREAD : [0.8, 1.2];
    const cut = (d) => (f.e && f.e.red ? d * (1 - f.e.red) : d);
    let lo = 0, hi = 0;
    if (a === "attack" || a === "power_attack") {
      let d = 0; try { d = f.weaponDamage(); } catch (e) { d = 0; }
      d = cut(d * (a === "power_attack" ? (typeof F !== "undefined" ? F.POWER_ATTACK_DAMAGE : 2) : 1));
      lo = d * s0; hi = d * s1;
    } else if (k === "poison" && typeof POISONFX !== "undefined") {
      out.note = POISONFX.note(f, a);   // [itemgames] nothing lands now: the next hit carries it
    } else if (k === "spell" || k === "dual" || k === "scroll") {
      const sp = spellOf(a);
      if (sp && sp.kind === "damage") {
        const MG = typeof MAGIC !== "undefined" ? MAGIC : null;
        let d = typeof G.spellDamage === "function" ? G.spellDamage(f.s, sp) : sp.amount || 0;
        if (k === "dual") d *= ((MG && MG.DUAL_POWER) || 2.2) * (typeof MOUNTFIGHT !== "undefined" && MOUNTFIGHT.dualPow ? MOUNTFIGHT.dualPow(f) : 1);
        if (MG && MG.elem && sp.element !== "sun" && f.tags) { try { d *= MG.elem(f, sp.element); } catch (e) { /* no foe tags */ } }
        if (f.fp && f.fp.ward) d *= 1 - f.fp.ward;
        if (sp.element === "sun" && f.tags && !f.tags.has("undead")) d = 0;
        lo = hi = d;
      } else if (sp && sp.kind === "heal") {
        out.heal = Math.round((typeof G.spellHeal === "function" ? G.spellHeal(f.s, sp) : sp.amount || 0) * (k === "dual" ? ((typeof MAGIC !== "undefined" && MAGIC.DUAL_POWER) || 2.2) : 1));
      }
    }
    lo = Math.max(lo > 0 ? 1 : 0, Math.round(lo)); hi = Math.max(lo, Math.round(hi));
    out.raw = [lo, hi];
    // the foe can't lose more than it has, nor more than the blow cap (a finishing blow on a nearly beaten foe is fine)
    const before = Math.max(0, f.ehp || 0), max = (sess && sess.ehpMax) || before, cap = HIT_CAP * max, trash = sess ? sess.trash : false;
    const capped = (d) => { d = Math.min(d, before); if (!sess || trash || before <= cap || d <= cap) return d; return d >= before && before <= cap * 1.2 ? d : Math.round(cap); };
    out.lo = capped(lo); out.hi = capped(hi); out.capped = out.hi < Math.min(hi, before);
    return out;
  }
  /* "9 stamina", "24 magicka · 4 health", "free" */
  function costTxt(c) {
    const out = []; if (!c) return "free";
    if (c.sp > 0) out.push(`${c.sp} stamina`); if (c.mp > 0) out.push(`${c.mp} magicka`); if (c.hp > 0) out.push(`${c.hp} health`);
    return out.length ? out.join(" · ") : "free";
  }
  /* the coloured numbers on a move's button: green stamina, blue magicka, red health */
  const costHTML = (c) => (c && (c.sp > 0 || c.mp > 0 || c.hp > 0) ? [["sp", c.sp], ["mp", c.mp], ["hp", c.hp]].filter(([, v]) => v > 0).map(([k, v]) => `<em class="rc ${k}">${v}</em>`).join("") : `<em class="rc free">✓</em>`);
  const isSpell = (a) => /^(spell|dual|scroll):/.test(a);
  /* [OURS] shared party fights: the foe's state handed over to a player's phone for their turn and back (sharedfight.js) */
  const FOE_KEYS = ["foeSt", "eParalyzed", "tbStunLeft", "tbStunCd", "tbStunRound", "stagger", "calmTurns", "bleed", "kit", "kitDot", "kitLast", "stk", "dStance", "fearTurns", "disarmed", "soulTrap", "eMagic", "fpAvoided", "ehp0", "foeTgts", "fcap"];
  /* what a teammate's spell can leave on someone (spellbook.js): handed back with the turn */
  const BUFF_KEYS = ["ward", "reflect", "armorRed", "armorT", "imbue", "thorns", "heroT", "unseen", "dmg", "_baseDmg"];
  /* "You hit the bandit" from one phone reads "Beta hits the bandit" on the others */
  const IRREG = { are: "is", were: "was", have: "has", do: "does", go: "goes", can: "can", "can't": "can't", will: "will", "don't": "doesn't", may: "may", must: "must", could: "could" };
  const conj = (w) => IRREG[w.toLowerCase()] || (/ed$/.test(w) ? w : /(s|sh|ch|x|z|o)$/.test(w) ? w + "es" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s");
  function voice(t, name) {
    if (!name) return String(t ?? "");
    let subj = false;
    const out = String(t ?? "").replace(/\byourself\b/gi, "themselves").replace(/(^|[.!?·]\s*|, )[Yy]ou('re)?\s+([A-Za-z']+)/g, (m, pre, re, w) => { subj = true; return re ? `${pre}${name} is ${w}` : `${pre}${name} ${conj(w)}`; })
      .replace(new RegExp(`(\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [a-z']+ [a-z']+ and )([a-z']+)`, "g"), (m, a, w) => a + (/s$/.test(w) ? w : conj(w)));   // "Beta holds back and keeps..."
    // after the name has been said: "their guard", not "Beta's guard" again
    return out.replace(/\b[Yy]ou're\b/g, `${name} is`).replace(/\b[Yy]ou've\b/g, `${name} has`).replace(/\b[Yy]ou are\b/g, `${name} is`)   // "(Beta is poisoned)", not "(Beta're poisoned)"
      .replace(/\b[Yy]ours\b/g, subj ? "theirs" : `${name}'s`).replace(/\b[Yy]our\b/g, subj ? "their" : `${name}'s`).replace(/\b[Yy]ou\b/g, name);
  }

  /* ------------------------------------------------------------------ the AI adapter (one place, so better AIs can plug in) */
  function aiPick(f, actor = "me", settings) {
    if (typeof COMBATAI !== "undefined" && COMBATAI.decide) {
      try { const r = COMBATAI.decide(f, actor, settings || f.aiSettings || null); if (r) { if (actor === "me" && r.action) f.aiPickWhy = r.rule ? `your rule ${r.rule}` : COMBATAI.shortWhy ? COMBATAI.shortWhy(r.action, r.why) : r.why || ""; return Array.isArray(r) ? r[0] : r.action || r; } } catch (e) { /* fall back */ }
    }
    try { const [, a] = f.choose(); return a || "attack"; } catch (e) { return "attack"; }
  }

  /* who to hit first (the "Target first" AI setting in aiset.js). Fights today have one foe (a gang or a pack is one foe),
     so this only picks among several when a fight brings extra foes in f.adds. */
  function targetOrder(f) {
    const foes = [f.e, ...(f.adds || [])].filter(Boolean);
    if (foes.length < 2 || typeof AISET === "undefined" || !AISET.pickTarget) return foes;
    try { return AISET.pickTarget(G.loadout(f.s), foes); } catch (e) { return foes; }
  }
  // ------------------------------------------------------------------ one fight, played round by round
  class Session {
    constructor(f, opts = {}) {
      this.f = f; this.s = f.s; this.opts = opts; this.round = 0; this.order = []; this.idx = 0;
      this.ev = [];             // what happened, for the screen: {who, text, line, kind}
      this.st = stats(f.s, f);
      this.used = {}; this.myActs = 0; this.pots = 0; this.cur = null; this.done = false;
      this.gr = null;           // the shared turn being played now (initiative.js groupAt + who we're still waiting for)
      this.meTok = 0;           // goes up every time your turn ends (sharedfight.js and autoTurn watch it)
      this.lines = { me: [], them: [], a: null };   // this round's log line for the fight log
      this.hitters = 0;
      this.everyone = f.allies.slice();   // who started the fight beside you (party view: knocked-down teammates stay listed)
      this.players = Math.min(7, f.allies.filter((a) => a.player && !a.follower && a.kind !== "follower").length);   // real players with you (a party is up to 8; followers never count)
      // foe archetypes and groups (foegroups.js): a bandit archer, a draugr mage... and on your own, sometimes 2 or 3 of them
      const grp = typeof FOEGROUPS !== "undefined" ? FOEGROUPS.prep(f, this.players) : { n: 1, hpMul: [1] };
      this.grp = grp;
      // turn-based foes are tougher (you act more than once a round); real players make it harder still
      const tg = f.tags; this.kind = f.e.boss ? "boss" : tg.has("elite") || f.e.danger === "high" ? "tough" : "normal";
      // the foe gets enough health for a fight of about T.rounds rounds against what you (and friends) deal a round,
      // within bounds, so fights don't end in two rounds at one level and drag on at another
      const dpr = this.estimate(f);   // you, your followers and summons, and every teammate's own turn
      const base = Math.max(1, f.ehp), kk = dpr > 0 ? clamp(dpr * T.rounds[this.kind] / base, T.min[this.kind], T.max[this.kind] * (1 + this.players)) : T.hp[this.kind];
      // a party faces more foes, not one sponge: the same total toughness, split over the foes. [rows] they stand on the
      // field together (foefield.js): a party of 2 meets 2-3, of 8 meets 6
      this.waves = this.players > 0 && !f.e.boss && !f.e.pool ? (typeof FOEFIELD !== "undefined" ? FOEFIELD.count(this.players + 1) : Math.min(MAX_FOES, 1 + this.players)) : grp.n; this.wave = 1;
      // another player fights with their real health; a raid dragon's health is shared by everyone fighting it (wevents.js)
      const k = f.e.player || f.e.pool ? 1 : this.players > 0 ? kk * (1 + PARTY_HP[this.kind]) / this.waves : kk;   // another player fights with their real health, no monster boost
      this.ehpBase = f.ehp * k * (f.diffHp = typeof DIFF !== "undefined" ? DIFF.hp(f) : 1);   // Story / Normal / Hard foe health, from the fight's snapshot (difficulty.js)
      f.ehp = Math.round(this.ehpBase * (grp.hpMul[0] || 1)); f.ehp0 = f.ehp; this.ehpMax = f.ehp;
      f.e.tbHp = this.ehpMax;
      f.regenMp *= MP_REGEN; f.regenSp *= SP_REGEN;   // several actions a round need a bit more breath and magicka per round
      f.tb = true;
      const t = opts.t || G.now();
      f.dark = G.isNight(t) || !!(f.wx && f.wx.aim < 1);
      f.hidden = opts.hidden != null && !opts.enemyFirst ? opts.hidden : opts.trySneak !== false && !opts.enemyFirst && Math.random() < G.hiddenChance(f.s, f.e, t);
      this.foeLevel = f.e.level ?? f.s.level;
      this.trash = f.e.danger === "low" && !f.e.boss;   // skeevers and mudcrabs can still be one-shot
      this.maxRounds = f.e.pool && opts.maxTurns ? opts.maxTurns : MAX_ROUNDS;   // a raid dragon climbs out of reach after a while
      if (typeof DRAGONS !== "undefined") DRAGONS.setup(f, this);   // dragons start in the air (dragons.js)
      if (typeof FOEKIT !== "undefined") FOEKIT.setup(f);   // what the foe can do besides a plain blow (foekit.js)
      if (typeof BOSSFIGHT !== "undefined") BOSSFIGHT.setup(f, this);   // bosses: phases, big attacks you see coming (bossfight.js)
      if (typeof FOEFIELD !== "undefined") FOEFIELD.setup(this);   // [rows] a group stands together in a front and a back row
    }
    /* rough damage a round from you and your allies (a typical turn of weapon swings, or your best damage spell) */
    estimate(f) {
      const s = f.s, st = this.st, R = T.rounds[this.kind] || T.rounds.normal;
      let w = 0, m = 0;
      try {
        const ai = typeof COMBATAI !== "undefined" && COMBATAI.swing, sw = ai ? COMBATAI.swing(f, false) : f.weaponDamage();
        if (f.regenSp > 0 && G.maxStamina) {
          /* [post-combat2 balance] a turn holds up to 3 AP of moves paid in stamina, so what you deal a round follows your
             stamina: what comes back each round plus your pool spread over the fight, a power attack first when you can
             afford it. (A flat "two swings a turn" guess let strong heroes end fights in 3-5 rounds.) */
          const cut = 1 - (st.spCut || 0), atk = Math.max(1, (ATK_SP[f.wt] || 9) * cut), pa = (f.wt === "bow" || f.wt === "crossbow" ? Math.max(f.paCost || 0, AIM_SP * (ATK_SP[f.wt] || 9)) : f.paCost || 0) * cut;   // the same aimed-shot price cost() charges
          let B = f.regenSp * SP_REGEN + T.est.pool * G.maxStamina(s) / R, n = 0;
          if (ai && pa > 0 && B >= pa) { w = COMBATAI.swing(f, true); B -= pa; n = 1; }
          w = (w + sw * clamp(B / atk, n ? 0 : 1, MAX_ACTS - 2 * n)) * T.est.k;   // [threeap] a power attack takes 2 of the 3 AP
        } else w = sw * (SWINGS[f.wt] || 2) * 0.8;
      } catch (e) { w = 0; }
      for (const id of s.spells || []) {
        const sp = D.SPELLS[id]; if (!sp || sp.kind !== "damage") continue;
        try { const d = G.spellDamage(s, sp), c = Math.max(1, G.spellCost(s, sp)), casts = clamp((f.regenMp * MP_REGEN + T.est.pool * f.mp / R) / c, 1, BIG.has(tierOf(id, sp)) ? 1 : MAX_ACTS - 1); m = Math.max(m, d * casts * T.est.mk); } catch (e) { /* skip */ }   // casts a round your magicka pays for (like stamina above)
      }
      let sm = 0;   // a summon you can afford fights beside you
      for (const id of s.spells || []) { const sp = D.SPELLS[id]; if (!sp || sp.kind !== "summon" || !G.spellSummon) continue; try { if (G.spellCost(s, sp) <= f.mp) sm = Math.max(sm, G.spellSummon(s, sp, f).dmg || 0); } catch (e) { /* skip */ } }
      const me = Math.max(w, m) + T.est.mix * Math.min(w, m) + T.est.sum * sm;   // spellswords mix blades and spells
      // [partyboss] a real teammate plays a whole turn on their own phone: what their phone says they deal a round
      // (COOP.profile → dpr), or as much as you if it didn't say; followers, pets and summons deal their blow
      const al = f.allies.reduce((a, x) => a + (isMate(x) ? (mateDpr(x, this.kind) || me) : (x.dmg || 0)), 0);
      return me + al;
    }
    emit(who, text, kind, extra = {}) {
      const e = { who, text, kind, round: this.round, hp: Math.max(0, Math.round(this.f.hp)), ehp: Math.max(0, Math.round(this.f.ehp)), ...extra };
      if (this.cur && this.cur.u && e.u == null && kind !== "round") e.u = this.cur.u;   // which slot it came from: the roster lights that portrait (initroster.js)
      if (this.remote && this.players && !this.mirror) { const ph = {}; for (const a of this.everyone) if (a.pid) ph[a.pid] = Math.max(0, Math.round(a.hp || 0)); e.ph = ph; }   // every player's health at this moment, for their own screens
      if (this.f._rxPend) { e.rx = this.f._rxPend; this.f._rxPend = null; }   // a combo landed: the banner (reactions.js)
      this.ev.push(e); return e;
    }
    get over() { const f = this.f; if (f.bf && typeof BOSSFIGHT !== "undefined") BOSSFIGHT.check(this); if (f.ehp <= 0 && f.hp > 0 && !f.endWon && this.wave < this.waves) this.nextFoe(); return f.hp <= 0 || f.ehp <= 0 || !!f.endWon || this.round > this.maxRounds; }
    /* a party fight: the foe fell, the next one steps in */
    nextFoe() {
      if (this.field && typeof FOEFIELD !== "undefined") { FOEFIELD.fell(this); return; }   // [rows] the others were already standing there: aim at the next one
      const f = this.f; this.wave++;
      const a = this.grp?.n > 1 && typeof FOEGROUPS !== "undefined" ? FOEGROUPS.next(f, this.wave - 1) : null;
      if (a) this.ehpMax = Math.round(this.ehpBase * (this.grp.hpMul[this.wave - 1] || 1));
      f.ehp = this.ehpMax; f.fpAvoided = false; f.tbStunLeft = 0; f.tbStunCd = 0;
      if (typeof FOEKIT !== "undefined") { const dt = f.kitDot; FOEKIT.setup(f); f.kitDot = dt; }   // the next one has its own kit
      if (typeof FIGHTREAD !== "undefined") FIGHTREAD.plan(this);
      if (typeof FOEINTENT !== "undefined") FOEINTENT.plan(this);   // and who each move goes for
      const left = this.waves - this.wave;
      const who = a ? `${String(f.e.name).toLowerCase()} ${a.label}` : String(f.e.name).toLowerCase();
      this.emit("foe", `${a ? "A" : "Another"} ${who} steps in! ${left ? `(${left} more behind it)` : "(the last one)"}`, "foe", { wave: this.wave });
      if (typeof SPELLFX !== "undefined") SPELLFX.nextFoe(this);   // area spells already reached it; single-target ones end here
    }
    /* the turn order for a new round (initiative.js): the rolls from the start of the fight, everyone's speed now */
    rollOrder() {
      const f = this.f;
      // the foe acts 1–3 times a round (whole actions, the fraction is a chance), more with a big party (T.party.acts per extra player)
      // [fight-logic] next round's count is rolled a round early (this._nextN) so the "next round" preview (initiative.js
      // predict, fightread.js intents) shows the moves and targets that really come, not a guess that the dice then change
      const rollN = () => { const b = T.acts[this.kind] + T.party.acts * this.players, w = Math.floor(b); return w + (Math.random() < b - w ? 1 : 0); };
      let n = this._nextN != null ? this._nextN : rollN();
      this._nextN = rollN();
      const nb = typeof ENCH2 !== "undefined" ? ENCH2.numb(f) : { acts: 0 }; n -= nb.acts;   // Numbing Cold: a move lost (it also slows it: initiative.js)
      return INIT.build(this, Math.max(1, n));
    }
    startRound() {
      const f = this.f;
      this.round++; f.turn = this.round; this.order = this.rollOrder(); this.idx = 0; this.hitters = 0;
      this.lines = { me: [], them: [], a: null };
      this.emit("round", `Round ${this.round}`, "round", { order: this.order.map((o) => ({ id: o.id, name: o.name, init: o.init, u: o.u, slot: o.slot })) });
      if (this.field && typeof FOEFIELD !== "undefined") FOEFIELD.plan(this);   // [rows] the foe side's moves spread over every foe standing, each with its own plan
      else if (this._pre && this._pre.round === this.round - 1 && this._pre.wave === this.wave && typeof FIGHTREAD !== "undefined" && FIGHTREAD.foeLeft(this) === this._pre.n && !this.f.dStance) {
        // [fight-logic] last round's screen already showed these moves and targets (fightread.js preplan): keep them, so
        // what the chips promised is what happens. Someone knocked down meanwhile gets a fresh roll (foeintent.js refresh).
        if (this.f.kit) this.f.kit.plan = this._pre.plan.slice();
        this.f.foeTgts = this._pre.tgts.map((t) => ({ ...t }));
        if (typeof FOEINTENT !== "undefined") FOEINTENT.refresh(this);
      } else {
        if (typeof FIGHTREAD !== "undefined") FIGHTREAD.plan(this);   // the foe's intents for this round (fightread.js)
        if (typeof FOEINTENT !== "undefined") FOEINTENT.plan(this);   // and who each one goes for (foeintent.js)
      }
      this._pre = null;
      if (this.f.bf && typeof BOSSFIGHT !== "undefined") BOSSFIGHT.plan(this);   // a boss shows its big attacks a turn ahead
      if (typeof REACT !== "undefined" && !this.field) REACT.retarget(this);   // covering your friends: its blows come to you (foefield.js plan does it per foe)
    }
    /* the foe gets a free action first (you were spotted, or fled and got caught) */
    begin() {
      if (this.opts.enemyFirst) { this.round = 0; this.foeAct("Ambush! "); this.f.log.push({ turn: 0, rule: null, me: "", them: this.lines.them.join(" · "), hp: Math.max(0, Math.round(this.f.hp)), ehp: Math.max(0, Math.round(this.f.ehp)) }); }
      this.startRound();
      return this.advance();
    }
    /* run automatic turns until it's a person's turn (yours, or real party members') or the fight ends */
    advance() {
      while (!this.over) {
        if (this.gr) { const r = this.pump(); if (r) return r; continue; }
        if (this.idx >= this.order.length) { this.endRound(); if (this.over) break; this.startRound(); continue; }
        this.tidy();
        const o = this.order[this.idx];
        if (!o) continue;
        if (o.done || o.out) { this.idx++; continue; }
        if (o.skip && !INIT.hero(o)) { this.skipSlot(o); this.idx++; continue; }   // stunned or frozen: this slot is lost
        if (INIT.hero(o)) { this.openGroup(); continue; }
        this.cur = o; this.autoActor(o); o.done = true; this.idx++;
      }
      return this.finish();
    }
    /* statuses fix up the order (initiative.js refresh): stuns, freezes, staggers, haste, slow, knocked out */
    tidy() {
      if (typeof INIT === "undefined" || this.mirror) return;
      for (const t of INIT.refresh(this)) { this.lines.them.push(t); this.emit("foe", t, "tick"); }
    }
    /* a stunned or frozen foe's slot comes up: it loses it */
    skipSlot(o) {
      const t = INIT.spend(this, o);
      if (t) { this.lines.them.push(t); this.emit("foe", t, "foe", { dmg: 0, skipped: o.moves || 1 }); }
      if (this.field && typeof FOEFIELD !== "undefined") FOEFIELD.skip(this);   // [rows] the stunned foe's move is the one lost
    }
    /* a real player in a party fight whose own phone picks (an older or offline phone: the AI never plays them) */
    isRemote(o) { return !!(o.al && o.al.player && o.al.pid && this.remote && !o.al.down && (!this.remote.live || this.remote.live())); }
    /* a shared turn starts: everyone side by side in the order acts together. Followers, pets and summons act on their
       orders at once; every real player is asked at the same time; you play yours. No timer: it waits for everyone. */
    openGroup() {
      const g = INIT.groupAt(this, this.idx);
      for (const o of g.skips) this.skipSlot(o);
      const party = !!(this.remote && this.players > 0 && !this.opts.auto);
      const t0 = Date.now();
      const gr = this.gr = { ...g, until: 0, waits: [], me: null, party };
      let asked = false;
      for (const o of g.members) {
        if (this.over) break;
        if (o.id === "me") { gr.me = o; continue; }
        if (this.isRemote(o)) {
          if ((o.al.late || 0) >= 2) { this.cur = o; this.allyMove(o.al, "guard", true); o.done = true; continue; }   // missed two turns: they just guard (no auto fighting)
          gr.waits.push({ pid: o.al.pid, name: o.al.name, until: 0, t0, seen: t0, al: o.al, o, tid: `${o.uid}.${o.al.pid}` }); asked = true;
          continue;
        }
        this.cur = o; this.autoActor(o); o.done = true;
      }
      if (asked) this.remote.ask(this, gr.waits[0].al);
      if (gr.me) this.cur = gr.me;
      this.tidy();
    }
    /* the shared turn goes on: replies that came in are played, then it's yours, or we wait, or it's over */
    pump() {
      const gr = this.gr, now = Date.now();
      for (const w of gr.waits) {
        if (w.fin) continue;
        const al = w.al;
        if (al.down || al.gone || this.over) { w.fin = true; w.o.done = true; continue; }
        if (w.reply) { const rp = w.reply; w.fin = true; al.late = 0; this.cur = w.o; this.applyRemote(al, rp); w.o.done = true; this.tidy(); continue; }   // their whole turn, played on their own fight screen
        if (w.move) { const m = w.move; w.fin = true; al.late = 0; this.cur = w.o; this.allyMove(al, m); w.o.done = true; this.tidy(); continue; }
        if (w.skip || this.dropped(w, now)) { w.fin = true; al.late = (al.late || 0) + 1; this.cur = w.o; this.allyMove(al, "guard", w.skip ? "skip" : "lost"); w.o.done = true; continue; }   // skipped by the leader, or their phone dropped out: they guard
      }
      if (this.over) return null;
      if (gr.me && !gr.me.done) {
        this.cur = gr.me;
        if (!this.apSet) this.beginTurn();
        if (this.opts.auto || this.autoRest) { this.autoTurn(); return null; }
        return { turn: "me", until: 0 };
      }
      const left = gr.waits.filter((w) => !w.fin);
      if (left.length) {
        this.cur = left[0].o;
        return { turn: "wait", who: left.map((w) => w.name).join(", "), n: left.length, until: 0, quiet: this.quiet(now).map((w) => ({ pid: w.pid, name: w.name })) };
      }
      for (const o of gr.members) o.done = true;   // everyone in it is done: on to what comes after
      this.idx = gr.end; this.gr = null;
      this.tidy();
      return null;
    }
    /* a player's phone dropped out: it never picked up the turn, and it's gone offline (or never answered for a while) */
    dropped(w, now = Date.now()) {
      if (w.ack) return false;
      const on = this.remote && this.remote.online ? this.remote.online(w.pid) : null;   // null: we can't tell
      return now - w.t0 >= INIT.CFG.lostAfter * 1000 && on !== true;
    }
    /* players in the shared turn who've made no move for 30 s: the leader may skip them (their moves turn into guard) */
    quiet(now = Date.now()) { return this.gr ? this.gr.waits.filter((w) => !w.fin && now - (w.seen || w.t0 || now) >= INIT.CFG.skipAfter * 1000) : []; }
    /* the leader skips a quiet player */
    skipPlayer(pid) { const w = this.gr && this.gr.waits.find((x) => !x.fin && x.pid === pid); if (!w) return false; w.skip = true; return true; }
    /* the first real player we're still waiting for (older code and tests read sess.waiting) */
    get waiting() { const w = this.gr && this.gr.waits.find((x) => !x.fin); return w || null; }
    set waiting(v) { /* the shared turn keeps its own list */ }
    /* guard with what's left (an older phone's own clock, or a test) */
    timeUp() { if (this.cur?.id !== "me" || !this.apSet) return; this.endTurn(true); this.emit("me", "You hold back and keep your guard up (out of time)", "guard"); }
    /* your turn ended */
    passMe() {
      this.apSet = false; this.meTok++;
      if (this.gr && this.gr.me) this.gr.me.done = true; else this.idx++;
    }
    /* ---- your actions */
    /* a new turn of yours: nothing used yet (apSet keeps its old name for the modules that check it) */
    beginTurn() {
      const up = typeof INIT !== "undefined" ? INIT.standUp(this.f) : Math.min(1, this.f.kitApLoss || 0);   // knocked down (thrown from the saddle, mountfight.js): 1 AP goes into getting up
      this.used = {}; this.myActs = up; this.pots = 0; this.apSet = true; this.f.kitApLoss = 0; this.held = null;
      this.f.tbGuard = 0;   // [threeap] the guard you kept lasted until now, your next turn
      if (up) this.emit("tick", "You get back on your feet (1 AP)", "tick");
      const w = typeof STACKS !== "undefined" ? STACKS.beginTurn(this.f) : "";   // Winded / Drained stacks bite (stacks.js)
      if (w) this.emit("tick", w.replace(/^ · /, ""), "tick");
      if (typeof REACT !== "undefined") REACT.beginTurn(this.f);   // Cover allies drops when your turn comes back
      if (this.f.kit) this.f.kit.myTurns = (this.f.kit.myTurns || 0) + 1;   // [first30] a teaching foe waits for your answer to its wind-up (foekit.js)
    }
    /* why you can't do a move now ("" = you can) */
    why(a) {
      const f = this.f;
      if (a === "end" || a === "flee") return "";
      const spent = this.myActs + (this.held && this.held.a !== a ? this.held.ap : 0);   // AP held for a move whose minigame is running
      if (spent >= this.st.acts) return "No AP left";
      if (/^potion:/.test(a) && this.pots >= this.st.pots) return this.st.pots === 1 ? "1 potion a turn" : `${this.st.pots} potions a turn`;
      if (a === "power_attack" && (this.used.power_attack || 0) >= 1) return "Once a turn";   // a power attack puts everything into one blow
      const c = cost(f, a, this);
      if (spent + c.acts > this.st.acts) return `Needs ${c.acts} AP`;   // a heavy move with 1 AP left
      if (c.sp > f.sp + 0.01 && !(a === "attack" && this.myActs === 0)) return `Need ${Math.ceil(c.sp - f.sp)} more stamina`;   // out of breath you can still swing once a turn (as in Skyrim)
      if (c.mp > f.mp + 0.01) return `Need ${Math.ceil(c.mp - f.mp)} more magicka`;
      if (c.hp > 0 && c.hp >= f.hp) return "Too hurt";
      return "";
    }
    canAfford(a) {
      if (a === "end" || a === "flee") return true;
      if (this.why(a)) return false;
      if (a === "bash") return typeof SHIELDFX !== "undefined" && SHIELDFX.can(this.f);
      if (typeof STRAT !== "undefined" && STRAT.owns(a)) return STRAT.can(this.f, a);
      if (typeof REACT !== "undefined" && REACT.owns(a)) return REACT.can(this.f, a);
      return this.f.affordable(a) || a === "attack";
    }
    /* after a move ran: take what the engine didn't (a plain blow, a shout, the repeat surcharge, blood for dark magic)
       and give back what your cheaper-move perks save */
    pay(a, c) {
      const f = this.f, e = c.eng || {};
      f.sp = clamp(f.sp - (c.sp - (e.sp || 0)), 0, G.maxStamina(f.s));
      f.mp = clamp(f.mp - (c.mp - (e.mp || 0)), 0, G.maxMagicka(f.s));
      if (c.hp > 0) f.hp = Math.max(1, f.hp - c.hp);
      this.used[a] = (this.used[a] || 0) + 1; this.myActs += c.acts > 0 ? c.acts : 1;
      if (c.perk) (f.apPerk = f.apPerk || {})[c.perk] = 1;   // the once-a-fight 1 AP perk is used up
      if (/^potion:/.test(a)) this.pots++;
    }
    /* [threeap] a minigame is about to run for move a: hold its AP (other buttons see them as spent) until it lands
       (act) or is called off (release). If its target is gone by the time it lands, it costs nothing. */
    reserve(a, tgt) {
      const f = this.f; if (this.cur?.id !== "me" || !a || a === "end" || a === "flee") return false;
      this.held = { a, ap: cost(f, a, this).acts, wave: this.wave || 1, ally: tgt != null && tgt !== "" ? String(tgt) : null };
      return true;
    }
    release() { this.held = null; }
    /* the move's target went away while it was being made: the foe is beaten or another took its place, or the
       friend you were helping is down */
    gone(a, al) {
      const f = this.f, h = this.held;
      if (al && al.down) return true;
      if (zoneOf(a) !== "foe") return false;
      return f.ehp <= 0 || !!(h && h.a === a && h.wave !== (this.wave || 1));
    }
    act(a, tgt, mult, grade) {   // mult: how the minigame went (minigame.js), 1 = normal; grade.cls "perfect" adds a stack
      if (this.cur?.id !== "me") return null;
      if (this.over) { this.passMe(); return { turn: "next" }; }   // the foe fell outside your moves (a tick, a teammate): any tap wraps the fight up instead of doing nothing
      const f = this.f;
      const al = tgt != null && tgt !== "" ? (+tgt >= 1000 ? (f._downed || [])[+tgt - 1000] : f.allies[+tgt]) : null;
      if (a === "end") return this.endTurn();
      if (a === "flee") return this.flee();
      if (this.gone(a, al)) { this.held = null; return { err: "Your target is already down: that move cost nothing", free: true }; }
      this.held = null;
      if (!this.canAfford(a)) return { err: this.why(a) || "You can't do that now" };
      const rowNote = this.field && typeof FOEFIELD !== "undefined" ? FOEFIELD.heroPre(this, a) : "";   // [rows] aim at a foe this move can reach (a Shieldwarden may step in)
      const price = cost(f, a, this);
      const before = f.ehp, myBefore = f.hp;
      let text = null;
      let setup = typeof STRAT !== "undefined" ? STRAT.setup(f) : "";   // staggered, stunned, chilled: an opening (strategy.js)
      const rxPre = typeof REACT !== "undefined" ? REACT.pre(f) : null;   // what the foe was open to before this move (reactions.js)
      if (typeof STRAT !== "undefined" && STRAT.owns(a)) text = STRAT.act(f, a);
      if (text == null && typeof REACT !== "undefined" && REACT.owns(a)) text = REACT.act(this, a);
      if (text == null && al && zoneOf(a) === "self") text = onAlly(f, a, al);
      if (text == null) { f.tbTarget = al || null; try { text = a === "bash" ? SHIELDFX.bash(f) : f.act(a); } finally { f.tbTarget = null; } }
      if (f.hidden) f.hidden = false;   // only your first strike can be a sneak attack
      if (mult && mult !== 1 && f.ehp < before) { f.ehp = before - (before - f.ehp) * mult; text += mult > 1 ? " (perfect timing!)" : " (mistimed)"; }
      else if (mult && mult !== 1 && f.hp > myBefore) { f.hp = Math.min(G.maxHealth(f.s), myBefore + (f.hp - myBefore) * mult); text += mult > 1 ? " (perfect!)" : " (shaky)"; }
      if (grade && grade.cls === "perfect" && typeof MINIGAME !== "undefined") text += MINIGAME.perfect(f, a, before);   // a Perfect adds a stack
      if (grade && typeof MINIGAME !== "undefined" && MINIGAME.itemFx) text += MINIGAME.itemFx(f, a, grade);   // [itemgames] an oil flask thrown well soaks longer
      if (typeof DRAGONS !== "undefined") text += DRAGONS.graze(f, a, before);
      if (typeof FOEKIT !== "undefined") text += FOEKIT.defend(f, a, before);   // its raised shield, ward or dodge
      if (typeof FOEROLES !== "undefined") text += FOEROLES.answer(this, a, before);   // [rows] a bash, a shock or a stagger breaks a channelled spell
      text += rowNote;
      if (f.bf && typeof BOSSFIGHT !== "undefined") text += BOSSFIGHT.answer(this, a, before);   // its helpers, and breaking a big attack
      const rx = typeof REACT !== "undefined" ? REACT.after(this, a, before, rxPre) : { text: "", key: null };   // Shatter, Exploit, Precision, Stagger exploit
      if (rx.key) { text += rx.text; setup = ""; f._rxPend = rx.key; }   // the combo replaces the plain opening
      else if (typeof COMBO !== "undefined" && f.ehp < before) text += COMBO.after(f, a, before);   // followers2: combos
      if (typeof STRAT !== "undefined" && f.ehp < before) text += STRAT.after(f, a, before, setup);
      if (typeof STACKS !== "undefined" && f.ehp < before) text += STACKS.after(f, a, before);   // Vulnerable, Sunder, Might
      text += this.capFoe(before);
      if (f.ehp < before) { text += this.flank(before); this.hitters++; }
      if (typeof DRAGONS !== "undefined") DRAGONS.check(f, this);
      this.pay(a, price);
      if (typeof STACKS !== "undefined") STACKS.sync(f);
      this.lines.me.push(text); this.lines.a = a;
      this.emit("me", text, "me", { a, wt: f.wt, dmg: Math.max(0, Math.round(before - f.ehp)), healed: Math.max(0, Math.round(f.hp - myBefore)) });
      this.tidy();   // a stun, a freeze, a stagger or a slow moves the foe in the order at once
      if (this.over) { this.passMe(); return { turn: "next" }; }
      if (this.field && typeof FOEFIELD !== "undefined") FOEFIELD.restore(this);   // [rows] back to the foe you aim at
      if (typeof STRAT !== "undefined" && STRAT.ends && STRAT.ends(a)) return this.endTurn(true);   // Breathe is your whole turn
      if (typeof REACT !== "undefined" && REACT.ends(a)) return this.endTurn(true);   // Cover allies is a stance
      if (this.myActs >= this.st.acts || !this.anyAffordable()) return this.endTurn(true);
      return { turn: "me" };
    }
    /* the AI's pick can't be paid (a 2 AP move with 1 AP left, no magicka): the hardest-hitting move you can still pay
       for, a plain blow or a damage spell (a mage's fists aren't worth a turn's last AP when a firebolt is there) */
    fallback() {
      const f = this.f; let best = null, bd = -1;
      try { if (this.canAfford("attack")) { best = "attack"; bd = typeof COMBATAI !== "undefined" && COMBATAI.swing ? COMBATAI.swing(f, false) : f.weaponDamage(); } } catch (e) { /* a plain blow it is */ }
      for (const id of f.s.spells || []) {
        const sp = D.SPELLS[id]; if (!sp || sp.kind !== "damage" || !this.canAfford("spell:" + id)) continue;
        let d = 0; try { d = G.spellDamage(f.s, sp); } catch (e) { d = sp.amount || 0; }
        if (d > bd) { bd = d; best = "spell:" + id; }
      }
      return best;
    }
    anyAffordable() { return ["attack", "block", "potion:health"].some((a) => this.canAfford(a)) || (this.f.s.spells || []).some((id) => this.canAfford("spell:" + id)); }
    /* AP you didn't spend become guard until your next turn: 10% less damage per AP (30% with all 3 kept);
       Steady Guard adds 5% per AP, up to 10% more */
    guardLeft() { return guardFor(this.f && this.f.s, this.st.acts - this.myActs); }
    endTurn(auto) {
      this.f.tbGuard = this.guardLeft();
      if (this.f.tbGuard > 0 && !auto) this.emit("me", `You hold back and keep your guard up (−${Math.round(this.f.tbGuard * 100)}% damage)`, "guard");
      this.passMe();
      return { turn: "next" };
    }
    flee() {
      const f = this.f, s = f.s;
      const ch = clamp(0.4 + G.skill(s, "Athletics") / 300 + G.skill(s, "Acrobatics") / 400 - (f.e.boss ? 0.3 : f.e.danger === "high" ? 0.15 : 0) - 0.05 * this.st.heavy + (f.e.pool ? 0.45 : 0), 0.05, 0.9);   // a raid: the town has plenty of places to hide
      if (Math.random() < ch) { f.endWon = true; f.escaped = true; f.ranAway = true; this.lines.me.push("You break away and escape"); this.emit("me", "You break away and escape!", "flee"); this.passMe(); return { turn: "next" }; }
      this.myActs = this.st.acts; this.lines.me.push("You try to break away, but can't"); this.emit("me", `You try to break away, but the ${f.e.name} cuts you off (${Math.round(ch * 100)}%)`, "flee");
      return this.endTurn(true);
    }
    /* Auto: the AI plays your turn */
    autoTurn() {
      const f = this.f;
      if (this.cur?.id !== "me" || this.over) return { turn: "next" };
      if (!this.apSet) this.beginTurn();
      const tok0 = this.meTok;
      let guard = 0;
      while (!this.over && this.meTok === tok0 && guard++ < MAX_ACTS + 2) {
        f.aiPickWhy = "";
        let a = aiPick(f, "me");
        const a0 = a;   // the AI's own pick, before the fight tricks below swap it
        if (!this.canAfford(a)) a = this.fallback();   // [threeap] a 2 AP move with 1 AP left: the best 1 AP hit instead
        if (typeof STRAT !== "undefined") a = STRAT.ai(this, a);   // cash in openings, catch your breath
        if (typeof REACT !== "undefined") a = REACT.ai(this, a);   // set up and cash in combos
        if (f.bf && typeof BOSSFIGHT !== "undefined") a = BOSSFIGHT.ai(this, a);   // answer a big attack that's coming
        if (!a) break;
        if (a === "block" && this.myActs > 0) break;   // keep the guard from AP you don't spend instead of a second raise
        if (this.used[a] >= 2 && this.myActs >= 2) break;   // a third of the same move costs double: save the breath, keep some guard
        if (this.field && typeof FOEFIELD !== "undefined") FOEFIELD.aiTarget(this, a);   // [rows] break a channelled spell first, then the most hurt foe in reach
        const n0 = this.ev.length, r = this.act(a);
        this.aiNote(n0, a, a === a0 ? f.aiPickWhy : "plays the opening");   // "[AI] reason" on the log line of a move the AI picked
        if (!r || r.turn !== "me" || r.err) break;
      }
      if (this.meTok === tok0 && !this.over) this.endTurn(true);
      return { turn: "next" };
    }
    /* the auto-played move's log line says why: "… [AI] finishing blow". Only for moves the AI picked, never yours. */
    aiNote(n0, a, why) {
      this.aiRound = this.round;
      if (!why) return;
      for (let i = this.ev.length - 1; i >= n0; i--) { const e = this.ev[i]; if (e.who === "me" && e.kind === "me" && e.a === a) { e.text += ` [AI] ${why}`; e.aiWhy = why; break; } }
      if (!(this.aiWhys = this.aiWhys || []).includes(why)) this.aiWhys.push(why);
    }
    /* ---- everyone else */
    autoActor(o) {
      const f = this.f;
      if (o.id.startsWith("foe")) return this.foeAct("");
      if (o.id === "sum") {
        if (this.field && typeof FOEFIELD !== "undefined" && f.summonTurns > 0) FOEFIELD.allyPre(this, { summon: true });   // [rows] your summon fights in the front row
        if (f.summonTurns > 0 && f.ehp > 0) { const b = f.ehp; f.summonTurns--; f.ehp -= f.summonDmg; const t = `Your ${f.summonName || "summon"} strikes ${Math.round(f.summonDmg)}` + this.capFoe(b) + this.flank(b); this.hitters++; this.lines.me.push(t); this.emit("sum", t, "ally"); }
        return;
      }
      if (o.al) return o.al.player && o.al.pid && !this.opts.auto ? this.allyMove(o.al, "guard", true) : this.allyMove(o.al, "auto");   // a real player is never played by the AI: no word from their phone, they just guard (noautoplay.js)
    }
    allyMove(al, move, timedOut) {
      if (!this.field || typeof FOEFIELD === "undefined" || this.mirror) return this.allyMove0(al, move, timedOut);
      FOEFIELD.allyPre(this, al);   // [rows] a friend's blade reaches the front row while it stands
      try { return this.allyMove0(al, move, timedOut); } finally { FOEFIELD.restore(this); }
    }
    allyMove0(al, move, timedOut) {
      const f = this.f;
      if (al.down || f.ehp <= 0) return;
      al.guard = 0; if (!al.pid) al.tbGuard = 0;   // [threeap] the guard kept on its last turn ends now, its next turn (a real player's comes back with their reply)
      if (al.fai && typeof FAI !== "undefined" && !(al.player && move && move !== "auto")) return FAI.turn(this, f, al);   // followers2: their own turn
      const b = f.ehp, hpB = f.hp, rxPre = typeof REACT !== "undefined" ? REACT.pre(f) : null;
      let t;
      if (al.player && move && move !== "auto") t = this.playerMove(al, move);
      else if (al.coop && typeof COOP !== "undefined") t = COOP.allyAct(f, al);
      else if (al.pet && typeof PETS !== "undefined") t = PETS.turn(f, al);   // your pet: its signature move or a bite (pets.js)
      else if (al.follower && f.ai && typeof COMBATAI !== "undefined") t = COMBATAI.followerAct(f, al);
      else { const d = al.dmg * (0.85 + Math.random() * 0.3); f.ehp -= d; t = ` · ${al.name} ${Math.round(d)}`; if (al.fsum && typeof COMBO !== "undefined") t += COMBO.phys(f, b, "al" + f.allies.indexOf(al)); }   // followers2: summons can shatter too
      t = String(t || "").replace(/^ · /, "");
      if (typeof REACT !== "undefined" && f.ehp < b && move !== "heal" && move !== "potion" && move !== "guard") { const rx = REACT.ally(this, f, al, move === "power" ? "power" : "attack", b, rxPre); if (rx.key) { t += rx.text; f._rxPend = rx.key; } }
      if (f.ehp < b) { t += this.capFoe(b) + this.flank(b); this.hitters++; }
      if (move === "heal" && f.hp > hpB && f.bf && typeof BOSSFIGHT !== "undefined" && BOSSFIGHT.cleanse) t += BOSSFIGHT.cleanse(f);   // a friend heals the boss's hex off you
      if (timedOut === "skip") t = `${al.name} is skipped and keeps their guard up. ` + t;
      else if (timedOut === "lost") t = `${al.name} lost the connection and keeps their guard up. ` + t;
      else if (timedOut) t = `${al.name} took too long and keeps their guard up. ` + t;
      if (al.left != null && --al.left <= 0) { f.allies = f.allies.filter((x) => x !== al); t += ` · ${al.name} fades away`; }   // a teammate's summon runs out
      this.lines.me.push(t);
      this.emit(al.player ? "mate" : "ally", t, "ally", { name: al.name, healed: Math.max(0, Math.round(f.hp - hpB)) });
    }
    /* a real player's chosen move (their phone sent it) */
    playerMove(al, m) {
      const f = this.f;
      if (m === "power") { const d = al.dmg * 1.6 * (0.85 + Math.random() * 0.3); f.ehp -= d; al.tired = 1; return `${al.name} power attack ${Math.round(d)}`; }
      if (m === "guard") { al.guard = 1; return `${al.name} raises their guard`; }
      if (m === "heal" && al.heals > 0) { al.heals--; const mh = G.maxHealth(f.s), b = f.hp; f.hp = Math.min(mh, f.hp + (al.healAmt || 40)); return `${al.name} heals you +${Math.round(f.hp - b)}`; }
      if (m === "potion" && al.pots > 0 && typeof POTFX !== "undefined") { al.pots--; return `${al.name} drinks a potion: ${POTFX.ally(al, "health", al.potAmt || 50, "Potion of Healing")}`; }
      if (m === "potion" && al.pots > 0) { al.pots--; al.hp = Math.min(al.maxHp || al.hp, al.hp + (al.potAmt || 50)); return `${al.name} drinks a potion`; }
      const d = al.dmg * (al.tired ? 0.8 : 1) * (0.85 + Math.random() * 0.3); al.tired = 0; f.ehp -= d; return `${al.name} attacks ${Math.round(d)}`;
    }
    /* a teammate played their turn on their own phone (sharedfight.js): take over what it did to the foe, to them and to
       the rest of us. r = {wave, e0, ehp, fs, hp0, hp, hpMax, guard, self, allies, summon, hits, fled, ev:[{text,a,dmg}]} */
    applyRemote(al, r) {
      const f = this.f;
      if (!r || !al || al.down) return;
      if (typeof PARTYSPELLS !== "undefined") PARTYSPELLS.learn(r.spells, f.s);   // the crafted spells they cast (partyspells.js)
      // [rows] the foe their phone aimed at (r.fi): it comes into aim here for their moves, then back to yours
      const fx = this.field && typeof FOEFIELD !== "undefined" && !this.mirror ? FOEFIELD.remotePre(this, r) : null;
      try { this.applyRemote0(al, r, fx); } finally { if (fx) FOEFIELD.restore(this); }
    }
    applyRemote0(al, r, fx) {
      const f = this.f;
      const name = al.name, b = f.ehp, sameFoe = fx ? fx.ok : r.wave == null || r.wave === this.wave;
      if (sameFoe && r.fs) for (const k of FOE_KEYS) {
        if (k === "ehp0") continue;
        if (r.fs0) { if (sameJ(r.fs[k], r.fs0[k])) continue; if (!(k in r.fs)) { delete f[k]; continue; } }   // [initiative] only what their turn changed: others in the same shared turn changed the rest
        if (k in r.fs) f[k] = r.fs[k] && typeof r.fs[k] === "object" ? clone(r.fs[k]) : r.fs[k];
      }
      // [threeap] the host has the last word on AP: a turn that says it spent more than 3 only lands its share of 3,
      // and the guard it keeps can't be more than its unspent AP give
      const moves = (r.ev || []).filter((e) => e && e.a && e.a !== "end" && e.a !== "flee").length;   // every move they report took 1 AP at least
      const spent = Math.max(0, +r.ap || 0, moves), apK = spent > AP ? AP / spent : 1, kept = AP - Math.min(AP, spent);
      if (sameFoe && typeof r.e0 === "number" && typeof r.ehp === "number") f.ehp = b - clamp((r.e0 - r.ehp) * apK, 0, Math.max(0, b));
      if (typeof r.hp === "number" && typeof r.hp0 === "number") { if (r.hpMax > 0) al.maxHp = r.hpMax; al.hp = clamp((al.hp || 0) + (r.hp - r.hp0), 1, al.maxHp || Math.max(al.hp || 1, r.hp)); }
      al.tbGuard = clamp(+r.guard || 0, 0, al.s ? guardFor(al.s, kept) : Math.min(GUARD_MAX + 0.1, GUARD_AP * kept + Math.min(0.1, 0.05 * kept)));
      if (typeof MOUNTFIGHT !== "undefined") MOUNTFIGHT.fromMate(al, r.mt);   // they got on / off their horse on their phone
      if (r.self) {
        if (r.self.ward > 0) al.ward = Math.max(al.ward || 0, r.self.ward);
        if (r.self.armorRed > (al.armorRed || 0)) { al.armorRed = Math.min(0.7, r.self.armorRed); al.armorT = Math.max(al.armorT || 0, r.self.armorT || 6); }
      }
      for (const x of r.allies || []) this.remoteBuff(x);
      if (r.summon && r.summon.turns > 0 && r.summon.dmg > 0) {   // their summon fights on its own, beside the rest of us
        let sm = f.allies.find((a) => a.summonOf === al.pid);
        if (!sm) { sm = { name: `${name}'s ${r.summon.name || "summon"}`, summon: true, summonOf: al.pid, speed: 5 }; f.allies.push(sm); }
        sm.dmg = r.summon.dmg; sm.left = Math.min(12, r.summon.turns);
      }
      this.hitters += Math.max(0, r.hits | 0);
      for (const e of (r.ev || []).slice(0, 12)) {
        const t = voice(e.text, name);
        this.lines.me.push(t);
        this.emit("mate", t, "ally", { name, a: e.a, wt: r.wt, by: al.pid, dmg: Math.max(0, Math.round(e.dmg || 0)) });
      }
      if (r.fled) {   // they broke away: out of this fight (their summon goes with them)
        al.gone = true; f.allies = f.allies.filter((x) => x !== al && x.summonOf !== al.pid);
        if (!(r.ev || []).length) this.emit("mate", `${name} breaks away and leaves the fight`, "ally", { name, by: al.pid });
      }
      if (typeof DRAGONS !== "undefined") DRAGONS.check(f, this);
    }
    /* a spell a teammate cast on someone else in the fight (heal, ward, stoneskin, rescue...) */
    remoteBuff(x) {
      const f = this.f;
      if (!x || !x.k) return;
      const up = typeof x.hp === "number" && typeof x.hp0 === "number" ? x.hp - x.hp0 : 0;
      if (x.k === "host") {
        if (up > 0) { const b = f.hp; f.hp = Math.min(G.maxHealth(f.s), f.hp + up); if (f.hp > b) this.emit("mate", `It mends you: +${Math.round(f.hp - b)} health`, "ally", { healed: Math.round(f.hp - b), by: "heal" }); }
        if (x.ward > 0 && x.ward > (f.ward || 0)) { f.ward = x.ward; f.wardMax = Math.max(f.wardMax || 0, x.ward); }
        return;
      }
      const all = [...new Set([...this.everyone, ...f.allies, ...(f._downed || [])])], al = all.find((a) => a.tbk === x.k);
      if (!al || al.gone) return;
      for (const k of BUFF_KEYS) if (k in x) al[k] = x[k] && typeof x[k] === "object" ? clone(x[k]) : x[k];
      const isDown = al.down || !f.allies.includes(al);
      if (isDown && x.revive) {   // pulled back from the brink
        al.down = false; al.hp = Math.max(1, x.hp || 1); f._downed = (f._downed || []).filter((a) => a !== al); if (!f.allies.includes(al)) f.allies.push(al);
        if (f.followerDown === al.name) f.followerDown = null;
      } else if (!isDown && up) al.hp = Math.max(1, (al.hp || 0) + up);
    }
    foeAct(prefix) {
      if (this.field && typeof FOEFIELD !== "undefined" && !this.mirror && !this._ffAct) {   // [rows] the next foe in line acts
        this._ffAct = true;
        try { FOEFIELD.foeTurn(this, (lb) => this.foeAct(prefix + (lb ? lb + ": " : ""))); } finally { this._ffAct = false; }
        return;
      }
      const f = this.f;
      if (f.ehp <= 0 || f.endWon) return;
      if (f.stagger && f._stagUsed) { f.stagger = false; f._stagUsed = false; }   // its stagger already cost it its place in the order (initiative.js)
      if (!this.ini && typeof SHIELDFX !== "undefined" && SHIELDFX.stunned(f, this.round)) {   // no turn order of its own (old tests): the stunned foe loses its whole turn
        if (this.stunSaid !== this.round) { this.stunSaid = this.round; const t = `${prefix}${f.e.name} is stunned and can't act`; this.lines.them.push(t); this.emit("foe", t, "foe", { dmg: 0 }); }
        return;
      }
      const hpB = f.hp;
      // foes go after your healers and casters when they can (party fights)
      const FI = typeof FOEINTENT !== "undefined" ? FOEINTENT : null;
      let act = null;   // the move it shows, by name (" Venom Spit → Meeko"): the log, the banner and the scene say it as it happens
      // [partyfoeturns] read this move's intent BEFORE its target is taken off the list: read after, it named the next
      // move's target ("Heavy Swing → you" while the blow hit a teammate)
      try { if (typeof FIGHTREAD !== "undefined" && !this.mirror) act = FIGHTREAD.actName(FIGHTREAD.intents(this)[0], this); } catch (x) { act = null; }
      const chRow = f.kit ? (f.kit.windup === "chan" ? f.kit.chanRow || "front" : f.kit.plan && f.kit.plan[0] && f.kit.plan[0].id === "channel" ? f.kit.plan[0].row || "front" : null) : null;
      if (act && chRow) { act.tgt = tr0(chRow === "back" ? "your back row" : "your front row"); act.row = true; }   // [rows] a channelled Fireball goes for a whole row
      if (FI) FI.next(this);   // foeintent.js: the target its intent showed (healers first is part of that roll)
      if (typeof REACT !== "undefined") REACT.foePre(this);   // Intercept: a blow meant for a friend comes to you
      else if (!FI && f.allies.length && !f.coverAl) { const h = f.allies.find((a) => !a.down && a.player && (a.role === "healer" || a.heals > 0)); if (h && Math.random() < 0.5) f.coverAl = h; }
      f.tgtHit = undefined;   // engine.js says who the blow really went to (null = the leader's hero)
      const guards = f.allies.filter((a) => a.guard || a.tbGuard); guards.forEach((a) => { a._red = a.red; a.red = Math.min(0.85, (a.red || 0) + (a.guard ? 0.4 : 0) + (a.tbGuard || 0)); });   // tbGuard: guard a teammate kept on their own phone
      const pa = this.everyone.filter((a) => a.pid), pb = pa.map((a) => a.hp || 0);
      if (typeof DRAGONS !== "undefined") DRAGONS.check(f, this);   // allies and bleeding may have brought it down
      const go = () => (typeof DRAGONS !== "undefined" && f.dStance ? DRAGONS.turn(f, () => f.enemyTurn()) : typeof FOEKIT !== "undefined" && f.kit ? FOEKIT.turn(f, () => f.enemyTurn()) : f.enemyTurn());
      let t = f.bf && typeof BOSSFIGHT !== "undefined" ? BOSSFIGHT.turn(this, go) : go();   // bosses: phases and big attacks (bossfight.js)
      guards.forEach((a) => { a.red = a._red; });   // [threeap] a guard lasts until that friend's next turn (allyMove / FAI.turn / applyRemote reset it)
      if (act && act.tgt && !act.row && f.tgtHit !== undefined) act.tgt = f.tgtHit ? String(f.tgtHit.name || act.tgt) : "you";   // someone stepped in front: name who it really hit
      if (FI) { FI.done(this); t = FI.say(this, t); }   // "takes aim at Lydia"
      if (typeof STACKS !== "undefined") {   // Chill and Weak stacks soften its blows (stacks.js)
        const so = STACKS.foeSoften(f), l0 = hpB - f.hp;
        if (so > 0 && l0 > 0) { f.hp += l0 * so; t += ` (−${Math.round(l0 * so)} chilled/weak)`; }
        STACKS.sync(f);
      }
      const loss = hpB - f.hp;
      if (loss > 0 && f.tbGuard) { const back = loss * f.tbGuard; f.hp += back; t += ` (guard −${Math.round(back)})`; }
      if (typeof REACT !== "undefined") t += REACT.foePost(this, hpB);
      const mh = G.maxHealth(f.s), cap = HIT_CAP * mh, loss2 = hpB - f.hp;
      if (loss2 > cap && hpB > cap) { f.hp = hpB - cap; t += " (you stay on your feet)"; }
      // [threeap] your kept guard stays up until your next turn (beginTurn), against every foe slot in between
      // the plan said a blow but the foe healed or drank instead (its own call in the engine): name what it really did
      if (act && /casts a healing spell|heals itself/i.test(t) && !/heal/i.test(act.name)) act = { ic: "", name: tr0("Heal self"), tgt: "", stk: "", big: false };
      else if (act && /drinks a potion|drinks a/i.test(t) && !/potion/i.test(act.name)) act = { ic: "", name: tr0("Drink potion"), tgt: "", stk: "", big: false };
      const named = act ?`${act.ic} ${act.name}${act.tgt ? ` → ${act.tgt}` : ""}: ` : "";
      this.lines.them.push(prefix + named + t);
      const hits = {}; pa.forEach((a, i) => { const d = Math.round(pb[i] - (a.hp || 0)); if (d > 0) hits[a.pid] = d; });
      this.emit("foe", prefix + named + t, "foe", { dmg: Math.max(0, Math.round(hpB - f.hp)), ...(pa.length ? { hits } : {}), ...(act ? { act } : {}) });
    }
    /* no one-shots on strong foes: one blow takes at most 40% of their health, unless it finishes them */
    capFoe(before) {
      const f = this.f, cap = HIT_CAP * this.ehpMax;
      if (this.trash || before <= cap || before - f.ehp <= cap || f.ehp <= 0 && before <= cap * 1.2) return "";
      f.ehp = before - cap;
      return " (it reels but stays up)";
    }
    /* flanking: every hit after the first one in a round lands 10% harder */
    flank(before) {
      const f = this.f;
      if (this.hitters < 1 || f.ehp <= 0) return "";
      const extra = (before - f.ehp) * 0.1; f.ehp -= extra;
      return " +flank";
    }
    endRound() {
      if (typeof SHIELDFX !== "undefined") SHIELDFX.endRound(this.f, this.round);
      const f = this.f, line = { turn: this.round, rule: null, me: this.lines.me.join(" · "), them: this.lines.them.join(" · "), a: this.lines.a || "attack", wt: f.wt, tb: true };
      if (this.aiRound === this.round) { line.ai = true; if (this.aiWhys && this.aiWhys.length) line.why = this.aiWhys.join(" · "); }   // only rounds the AI played for you
      this.aiWhys = [];
      if (this.field && typeof FOEFIELD !== "undefined") FOEFIELD.tick(this, line);   // [rows] bleeding and burning on the foes you're not aiming at
      if (f.bleed.length && f.ehp > 0) { const b = f.bleed.reduce((x, y) => x + y.dmg, 0); f.ehp -= b; f.bleed = f.bleed.map((y) => ({ ...y, turns: y.turns - 1 })).filter((y) => y.turns > 0); line.me += ` · bleeds ${Math.round(b)}`; }
      const n0 = line.me.length, t0 = line.them.length;
      if (typeof PFX !== "undefined") PFX.tick(f, line);
      if (f.dd && typeof DEEPDELVE !== "undefined") DEEPDELVE.tick(f, line);   // deepdelve.js
      if (typeof MAGIC !== "undefined" && !f.endWon) MAGIC.tick(f, line);
      if (f.pw && typeof POWERS !== "undefined") POWERS.tick(f, line);
      if (typeof STACKS !== "undefined") STACKS.tick(f, line);   // every stack drops by 1
      if (typeof REACT !== "undefined") REACT.tick(f, line);   // burning ground
      const extra = (line.me.slice(n0) + line.them.slice(t0)).replace(/^ · /, "");
      if (extra) this.emit("tick", extra, "tick");
      line.hp = Math.max(0, Math.round(f.hp)); line.ehp = Math.max(0, Math.round(f.ehp));
      f.log.push(line);
      f.sp = Math.min(G.maxStamina(f.s), f.sp + f.regenSp * (f.regenSpHold ? 0.5 : 1)); f.regenSpHold = false;
      f.mp = Math.min(G.maxMagicka(f.s), f.mp + f.regenMp);
      f.slowed = Math.max(0, f.slowed - 1);
      if (f.mount && typeof HORSEBACK !== "undefined") HORSEBACK.tick(f);
    }
    finish() {
      const f = this.f;
      if (this.done) return { turn: "done", won: f.won };
      if (this.lines.me.length || this.lines.them.length) { const line = { turn: this.round, rule: null, me: this.lines.me.join(" · "), them: this.lines.them.join(" · "), a: this.lines.a || "attack", wt: f.wt, tb: true, hp: Math.max(0, Math.round(f.hp)), ehp: Math.max(0, Math.round(f.ehp)) }; if (!f.log.length || f.log[f.log.length - 1].turn !== this.round) f.log.push(line); }
      if (this.round > this.maxRounds && f.hp > 0 && f.ehp > 0) { f.endWon = true; f.escaped = true; this.emit("foe", f.e.pool ? `The ${f.e.name} climbs out of reach and circles the town` : `The ${f.e.name} breaks off and withdraws`, "foe"); }
      this.done = true;
      f.won = f.ehp <= 0 || !!f.endWon;
      if (f.endWon) { f.e.fled = true; f.e.gold = [0, 0]; }
      f.e.hp = Math.max(0, Math.round(f.ehp / ((this.ehpMax / (f.e.health || this.ehpMax)) || 1)));
      f.tbRounds = this.round; f.tbPlayed = true;
      this.emit("end", f.won ? (f.escaped ? "You got away." : "Victory!") : "Defeated…", "end");
      return { turn: "done", won: f.won };
    }
  }

  /* play a whole fight with the AI on every side (sims, tests, "Auto" from the start) */
  function simulate(f, opts = {}) {
    const ss = new Session(f, { ...opts, auto: true });
    ss.begin();
    let guard = 0;
    while (!ss.done && guard++ < 500) ss.advance();
    return ss;
  }

  // ------------------------------------------------------------------ pausing a game action at its fight, and resuming it
  const PENDING = { tbPending: true };
  let mode = null, pend = null, fin = null, finalS = null, rec = [], rp = 0, drec = [], dcut = -1;
  const realRandom = Math.random;
  const clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  function replaceInPlace(target, src) { for (const k of Object.keys(target)) delete target[k]; Object.assign(target, clone(src)); }
  /* like replaceInPlace, but keeps the same inner objects (the trip, the encounter...) so code that already holds them
     (e.g. `const tr = s.trip` before the fight) updates the real save. Without this a won road fight left the road blocked. */
  const plain = (o) => o && typeof o === "object" && !Array.isArray(o) && Object.prototype.toString.call(o) === "[object Object]";
  function syncInPlace(target, src) {
    for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
    for (const k of Object.keys(src)) {
      const a = target[k], b = src[k];
      if (plain(a) && plain(b)) syncInPlace(a, b);
      else if (Array.isArray(a) && Array.isArray(b)) { a.length = 0; for (const x of b) a.push(clone(x)); }
      else target[k] = b && typeof b === "object" ? clone(b) : b;
    }
  }
  const origRun = G.Fight.prototype.run;
  G.Fight.prototype.run = function (opts = {}) {
    if (mode === "capture") { mode = "captured"; pend = { f: this, opts }; throw PENDING; }
    if (mode === "replay" && fin) {
      const done = fin, eLocal = this.e; fin = null; mode = null;
      for (const k of Object.keys(done)) if (k !== "s" && k !== "e") this[k] = done[k];
      Object.assign(eLocal, { hp: done.e.hp, fled: done.e.fled, gold: done.e.gold });
      this.e = eLocal;
      syncInPlace(this.s, finalS); finalS = null;
      this.tbPlayed = true;
      return this.won;
    }
    if (mode === "direct" && dcut < 0) dcut = drec.length;   // no fight screen: where the fight's own dice start (a retry replays only what came before)
    return origRun.call(this, opts);
  };
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  /* turn-based is on unless switched off in Settings; under browser automation only with ?tb (keeps the old UI tests as they were) */
  function enabled() {
    if (typeof navigator !== "undefined" && navigator.webdriver && !(typeof location !== "undefined" && /[?&]tb\b/.test(location.search))) return false;
    return typeof document !== "undefined";
  }
  /* Run a game action. If it starts a fight, play the fight on screen, then finish the action with that result.
     done(result) gets the same object the action would have returned. */
  let saveSnap = null, liveS = null;
  /* store.js: while a fight is on screen, a save keeps the game as it was just before it (closing the app mid-fight
     puts you back in front of the fight instead of half-way through the action that started it) */
  function safeSave(st) { return open && saveSnap && st === liveS ? saveSnap : st; }
  /* dice: { pre, sess } from a lost fight (defeat.js Retry): the same rolls up to and including the fight's setup, so a
     retry meets the same foes; the fight itself rolls fresh. */
  const DF = () => (typeof DEFEAT !== "undefined" ? DEFEAT : null);
  function call(S, fn, done, ctx = {}, dice = null) {
    if (open || mode) return done(fn());
    if (!enabled()) {   // no fight screen (tests, automation): a lost fight still goes to the defeat screen, nothing lost
      const df = DF();
      if (!df) return done(fn());
      const snapI = clone(S), pre = dice?.pre || [], rnd0 = Math.random, mine = (drec = []);
      let pp = 0, r;
      dcut = -1; mode = "direct";
      Math.random = () => { const v = pp < pre.length ? pre[pp++] : rnd0(); mine.push(v); return v; };
      try { r = fn(); } finally { Math.random = rnd0; mode = null; }
      const cut = dcut < 0 ? mine.length : dcut; dcut = -1;
      if (r && r.fight && df.lostFight(r.fight)) {
        df.forget(); replaceInPlace(S, snapI);
        return df.offer({ S, f: r.fight, sess: null, retry: () => call(S, fn, done, ctx, { pre: mine.slice(0, cut) }), retreat: (text) => done({ text, title: "Fell back", retreated: true }) });
      }
      return done(r);
    }
    const snap0 = clone(S);
    const pre = dice?.pre || [], ses = dice?.sess || [];
    let pp = 0;
    rec = []; mode = "capture";
    Math.random = () => { const v = pp < pre.length ? pre[pp++] : realRandom(); rec.push(v); return v; };
    let r;
    try { r = fn(); }
    catch (x) {
      Math.random = realRandom;
      if (x !== PENDING) { mode = null; throw x; }
      const { f, opts } = pend; pend = null; mode = null;
      const preRec = rec.slice(), sesRec = [];
      let sp = 0;
      Math.random = () => { const v = sp < ses.length ? ses[sp++] : realRandom(); sesRec.push(v); return v; };
      let sess;
      try { sess = new Session(f, opts); } finally { Math.random = realRandom; }
      saveSnap = snap0; liveS = S;
      return play(sess, ctx, () => {
        saveSnap = null; liveS = null;
        const df = DF();
        if (df && df.lostFight(f)) {   // lost: nothing is lost. Back to just before the action, then Retry / Adjust gear / Retreat
          Math.random = realRandom; mode = null; fin = null; finalS = null;
          df.forget(); replaceInPlace(S, snap0);
          return df.offer({ S, f, sess, retry: () => call(S, fn, done, ctx, { pre: preRec, sess: sesRec }), retreat: (text) => done({ text, title: "Fell back", retreated: true }) });
        }
        finalS = clone(S);
        replaceInPlace(S, snap0);
        fin = f; mode = "replay"; rp = 0;
        const recd = rec;
        Math.random = () => (rp < recd.length ? recd[rp++] : realRandom());
        let out;
        try { out = fn(); } finally { Math.random = realRandom; mode = null; fin = null; }
        done(out);
      });
    }
    Math.random = realRandom; mode = null;
    return done(r);
  }

  // ------------------------------------------------------------------ the fight screen
  let open = false, ui = null, hooks = {};
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fast = () => false;   // build 146: the Fast button is gone; an old saved tbFast is ignored
  function init(h) { hooks = h || {}; }
  function play(sess, ctx, onDone) {
    open = true;
    ui = { sess, ctx, onDone, shown: 0, menu: null, busy: false, queue: [] };
    if (hooks.remote && !sess.mirror) sess.remote = hooks.remote;   // a teammate's view of the leader's fight never publishes a fight of its own
    let el = document.getElementById("tbf");
    if (!el) { el = document.createElement("div"); el.id = "tbf"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Turn-based fight"); document.body.appendChild(el); }
    el.className = "tbf ink";
    el.addEventListener("click", onClick);
    const r = sess.begin();
    render(r);
    if (sess.done && !ui.paceT) render({ turn: "done" });
    tickWait();
  }
  function pctBar(v, m, cls) { return `<div class="tbbar ${cls}"><i style="width:${Math.max(0, Math.min(100, 100 * v / Math.max(1, m))).toFixed(1)}%"></i></div>`; }
  function icon(o, f) { return o.id === "me" ? "" : o.id.startsWith("foe") ? (f?.e?.player ? "" : "") : o.id === "sum" ? "✦" : "⚑"; }
  /* where an action is dragged: onto the foe, or onto yourself (tbui.js does the dragging; a tap still works) */
  const SELF_KINDS = new Set(["heal", "armor", "ward", "summon", "cloak", "support", "invis", "bound", "light", "circle", "rune", "utility"]);
  function zoneOf(a) {
    if (typeof BEASTPATH !== "undefined" && BEASTPATH.zone(a)) return BEASTPATH.zone(a);
    if (a === "attack" || a === "power_attack" || a === "bash" || /^(shout|power):/.test(a)) return "foe";
    if (a === "block" || /^(potion|poison):/.test(a)) return "self";
    if (a === "rx:oil" || a === "rx:mark") return "foe";
    const sp = spellOf(a);
    if (sp) return typeof SPELLBOOK !== "undefined" && SPELLBOOK.SUPPORT.has(sp.kind) ? "ally" : SELF_KINDS.has(sp.kind) ? "self" : "foe";
    return "";
  }
  /* a healing spell, potion or scroll you dragged onto a teammate instead of yourself */
  function onAlly(f, a, al) {
    const [k, arg] = a.split(":");
    if (typeof al.hp !== "number" || !isFinite(al.hp)) return null;   // [fight-logic] a called ally with no health bar (Odahviing, a hero of Sovngarde, a wild animal): the heal goes to you, it used to turn their health into NaN
    const mx = al.maxHp || al.hpMax || al._max || Math.max(al.hp, 60), b = al.hp;
    if (k === "potion") {
      const r = f.findPotion(arg); if (!r) return null;
      const it = D.ITEMS[r.item]; f.used[r.id] = (f.used[r.id] || 0) + 1;
      if (arg !== "health") { f.used[r.id]--; return null; }   // only health potions can be given
      if (typeof POTFX !== "undefined") return `You give ${al.name} a ${it.name}: ${POTFX.ally(al, "health", it.restore[1], it.name)}`;   // over a few rounds (potionfx.js)
      al.hp = Math.min(mx, al.hp + it.restore[1]); return `You give ${al.name} a ${it.name}: +${Math.round(al.hp - b)}`;
    }
    const sp = spellOf(a); if (!sp || sp.kind !== "heal") return null;
    const dual = k === "dual", free = k === "scroll";
    if (free) { const r = f.findItem(arg); if (!r) return null; f.used[r.id] = (f.used[r.id] || 0) + 1; }
    else f.mp -= (typeof G.spellCost === "function" ? G.spellCost(f.s, sp) : sp.cost) * (dual ? 2.2 : 1);
    const amt = sp.amount * (1 + (G.fxSum ? G.fxSum(f.s, "spell:Restoration") : 0) / 100) * (dual ? 2.2 : 1) * (1 + (typeof PFX !== "undefined" ? PFX.sum(f.s, "healally", f, {}) : 0));
    if (typeof f.addXp === "function") f.addXp("Restoration", sp.xp || 10);
    al.hp = Math.min(mx, al.hp + amt); return `${sp.name} on ${al.name}: +${Math.round(al.hp - b)}`;
  }
  const ICON = { recover: "", bash: "", attack: "", bow: "", power_attack: "", block: "", magic: "✦", items: "", flee: "", end: "", shout: "", power: "", potion: "", scroll: "", heal: "✚" };
  function iconOf(f, a) {
    if (typeof BEASTPATH !== "undefined") { const ic = BEASTPATH.icon(f, a); if (ic) return ic; }
    if (a === "mount" || a === "dismount") return "\uE12D";
    if (typeof REACT !== "undefined" && REACT.owns(a)) return REACT.IC[a.slice(3)] || "•";
    if (a === "attack") return f.wt === "bow" || f.wt === "crossbow" ? ICON.bow : ICON.attack;
    const k = a.split(":")[0];
    if (k === "spell" || k === "dual") { const sp = spellOf(a); return sp?.kind === "heal" ? ICON.heal : sp?.element === "fire" ? "" : sp?.element === "frost" ? "" : sp?.element === "shock" ? "" : ICON.magic; }
    return ICON[a] || ICON[k] || "•";
  }
  const guardTxt = (sess) => { const g = Math.round(sess.guardLeft() * 100); return g > 0 ? `+${g}% guard` : "ready"; };
  function actionsHTML(sess) {
    if (typeof FIGHTCTL !== "undefined" && FIGHTCTL.on()) return FIGHTCTL.dock(sess, { menu: ui.menu, cost, zoneOf, iconOf, tierOf });   // fightctl.js: the action bar
    const f = sess.f, s = f.s, B = (a, label, extra = "") => { const c = cost(f, a, sess), ok = sess.canAfford(a), z = zoneOf(a);
      const tip = typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, a, c))}"` : "";
      return `<button class="tbact ${extra}" data-tba="${esc(a)}"${z ? ` data-tz="${z}"` : ""}${tip} ${ok ? "" : "disabled"}><span class="ic" aria-hidden="true">${iconOf(f, a)}</span><b>${esc(label)}</b><small>${esc(costTxt(c))}</small><span class="cp" aria-hidden="true">${costHTML(c)}</span></button>`; };
    if (ui.menu === "magic") {
      const rows = (s.spells || []).filter((id) => D.SPELLS[id] && D.SPELLS[id].kind !== "utility").map((id) => {
        const sp = D.SPELLS[id], mc = typeof G.spellCost === "function" ? Math.round(G.spellCost(s, sp)) : sp.cost;
        const dual = typeof MAGIC !== "undefined" && MAGIC.dualable && MAGIC.dualable(sp);
        return `<div class="tbsp"><span class="nm el-${esc(sp.element || "none")}">${esc(sp.name)}<small>${esc(tierOf(id, sp))} · ${mc} magicka</small></span>${B("spell:" + id, "Cast")}${dual ? B("dual:" + id, "Dual") : ""}</div>`;
      }).join("") || `<p class="sub">You don't know any fighting spells yet.</p>`;
      return `<div class="tbmenu"><div class="tbmh"><b>✦ Magic</b><small>Drag a spell onto its target, or tap Cast</small></div>${rows}<button class="tbact back" data-tbm="">‹ Back</button></div>`;
    }
    if (ui.menu === "items") {
      const pots = ["health", "magicka", "stamina"].map((r) => (f.findPotion(r) ? B("potion:" + r, `${r[0].toUpperCase() + r.slice(1)} potion`) : "")).join("");
      const scrolls = [...new Set(s.inv.filter((r) => D.ITEMS[r.item]?.spell && f.left(r.id) > 0).map((r) => r.item))].slice(0, 4).map((it) => B("scroll:" + it, D.ITEMS[it].name)).join("");
      const shouts = typeof POWERS !== "undefined" && f.pw ? (POWERS.known ? [] : []).join("") : "";
      const poisons = typeof POISONFX !== "undefined" ? POISONFX.list(f).slice(0, 4).map(([a, n]) => B(a, n)).join("") : "";   // coat your weapon (poisonfight.js)
      return `<div class="tbmenu"><div class="tbmh"><b> Items</b><small>Drag a potion onto yourself, or tap it</small></div><div class="tbgrid">${pots || scrolls || poisons ? pots + scrolls + poisons : `<p class="sub">No potions or scrolls.</p>`}${shouts}</div><button class="tbact back" data-tbm="">‹ Back</button></div>`;
    }
    const bx = typeof BEASTPATH !== "undefined" ? BEASTPATH.moves(f) : { form: null, list: [] };   // Beast Form / Vampire Lord moves, vampire powers (beastpaths.js)
    const mv = (typeof MOUNTFIGHT !== "undefined" && !bx.form ? MOUNTFIGHT.moves(f) : []).concat(typeof REACT !== "undefined" && !bx.form ? REACT.moves(f) : []);   // Mount / Dismount (mountfight.js), Oil flask, Mark, Cover (reactions.js)
    const sh = bx.form ? "" : shoutsFor(f).map(([a, n]) => B(a, n, "shout")).join("") + bx.list.map(([a, n]) => B(a, n, "shout beast")).join("") + mv.map(([a, n]) => B(a, n, "mount")).join("");
    if (typeof TBRADIAL !== "undefined" && TBRADIAL.on()) {   // the combat wheel: moves in a ring round End turn
      const W = (a, label, extra = "") => { const c = cost(f, a, sess), ok = sess.canAfford(a), z = zoneOf(a);
        const tip = typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, a, c))}"` : "";
        return `<button class="tbact ${extra}" data-tba="${esc(a)}"${z ? ` data-tz="${z}"` : ""}${tip} ${ok ? "" : "disabled"}><span class="ic" aria-hidden="true">${iconOf(f, a)}</span><b>${esc(label)}</b><small>${esc(TBRADIAL.costLine(f, a, c))}</small></button>`; };
      const sl = bx.form ? [...bx.list.map(([a, n]) => W(a, n, "main beast")), W("flee", "Flee", "flee")] : [W("attack", f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack", "main"), W("power_attack", "Power", "main"),
        f.shield && typeof SHIELDFX !== "undefined" ? W("bash", "Bash", "main") : W("block", "Guard", "main"),
        `<button class="tbact menu" data-tbm="magic"><span class="ic" aria-hidden="true">${ICON.magic}</span><b>Magic ▸</b><small>${(s.spells || []).length} spells</small></button>`,
        `<button class="tbact menu" data-tbm="items"><span class="ic" aria-hidden="true">${ICON.items}</span><b>Items ▸</b><small>potions</small></button>`,
        ...shoutsFor(f).map(([a, n]) => W(a, n.replace("Shout ", ""), "shout")), ...bx.list.map(([a, n]) => W(a, n, "shout beast")), ...mv.map(([a, n]) => W(a, n, "mount")), W("flee", "Flee", "flee")];
      const hub = `<button class="tbact end" data-tba="end"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, "end", 0))}"` : ""}><span class="ic" aria-hidden="true">${ICON.end}</span><b>End</b><small>${guardTxt(sess)}</small></button>`;
      return TBRADIAL.wheel(sl, hub);
    }
    const endB = `<button class="tbact end" data-tba="end"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, "end", 0))}"` : ""}><span class="ic" aria-hidden="true">${ICON.end}</span><b>End turn</b><small>${guardTxt(sess)}</small></button>`;
    if (bx.form) return `<div class="tbgrid beastgrid ${bx.form}">${bx.list.map(([a, n]) => B(a, n, "main beast")).join("")}${B("flee", "Flee", "flee")}${endB}</div>`;
    return `<div class="tbgrid">${B("attack", f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack", "main")}${B("power_attack", "Power attack", "main")}${f.shield && typeof SHIELDFX !== "undefined" ? B("bash", "Shield bash", "main") : B("block", "Guard", "main")}
      <button class="tbact menu" data-tbm="magic"><span class="ic" aria-hidden="true">${ICON.magic}</span><b>Magic ▸</b><small>${(s.spells || []).length} spells</small></button>
      <button class="tbact menu" data-tbm="items"><span class="ic" aria-hidden="true">${ICON.items}</span><b>Items ▸</b><small>potions</small></button>${sh}
      ${B("flee", "Flee", "flee")}
      <button class="tbact end" data-tba="end"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, "end", 0))}"` : ""}><span class="ic" aria-hidden="true">${ICON.end}</span><b>End turn</b><small>${guardTxt(sess)}</small></button></div>`;
  }
  function shoutsFor(f) {
    if (typeof POWERS === "undefined" || !f.pw) return [];
    const out = [];
    for (const a of ["shout:fus", "shout:yol", "shout:fo", "power:racial"]) { try { if (f.affordable(a)) out.push([a, a.startsWith("shout") ? "Shout " + a.split(":")[1].toUpperCase() : "Racial power"]); } catch (e) { /* not known */ } }
    return out.slice(0, 2);
  }
  function render(state) {
    try { if (typeof FOEINTENT !== "undefined" && ui?.sess) FOEINTENT.refresh(ui.sess); } catch (e) { /* never break a fight for a marker */ }
    try { ui?.sess?.remote?.sync?.(ui.sess); } catch (e) { /* the party view never breaks the fight */ }
    const el = document.getElementById("tbf"); if (!el || !ui) return;
    const sess = ui.sess, f = sess.f, s = f.s;
    /* [fightread] play what happened one event at a time (Fast  shows it all at once, Skip jumps to the end) */
    const R = typeof FIGHTREAD !== "undefined" ? FIGHTREAD : null;
    clearTimeout(ui.paceT); ui.paceT = null;
    let cut = sess.ev.length;
    if (R && R.paced() && !ui.skip && !sess.autoRest && cut - ui.shown > 1) { cut = ui.shown + 1; const wait = R.delay(sess.ev[ui.shown]); ui.pendState = state; ui.paceT = setTimeout(() => { if (ui && ui.sess === sess) render(ui.pendState); }, wait); }
    const playing = cut < sess.ev.length;
    if (!playing) { ui.skip = false; ui.pendState = null; }
    const vis = playing ? sess.ev.slice(0, cut) : sess.ev;
    const newEv = vis.slice(ui.shown); ui.shown = cut;
    if (playing) state = { turn: "play" };
    // the turn order: whoever is acting right now is lit, while you choose AND while the others' turns play out one by one
    const pe = playing ? vis[vis.length - 1] : null;
    const uNow = !!(pe && pe.u && sess.order.some((o) => o.u === pe.u));   // a move from a round that is already over (still playing out) has a slot that is gone: match by who
    const acting = (o) => (pe ? (uNow && o.u ? o.u === pe.u : pe.kind === "foe" ? o.id.startsWith("foe") : pe.kind === "me" ? o.id === "me" : pe.kind === "ally" ? o.name === pe.name || (pe.pid && o.pid === pe.pid) : pe.kind === "sum" ? o.id === "sum" : false) : o.id === sess.cur?.id && !sess.done);
    const actIdx = sess.order.findIndex(acting);
    // [initiative] the turn roster (initroster.js): portraits in initiative order, shared turns bracketed, a fast foe's
    // two slots marked 1 and 2, lost turns crossed out, the next round dimmed after the marker; +N opens the whole order
    const wide = typeof innerWidth !== "undefined" && innerWidth >= 900;
    const order = typeof INITUI !== "undefined" ? INITUI.strip(sess, { playing, acting, actIdx }) + INITUI.more(sess, wide)
      : sess.order.map((o, i) => `<span class="tbini ${acting(o) ? "now" : ""} ${(playing ? actIdx >= 0 && i < actIdx : i < sess.idx) ? "gone" : ""} ${o.id.startsWith("foe") ? "foe" : o.id === "me" ? "me" : "ally"}">${icon(o, f)} ${esc(o.name.split(" ")[0])}<i>${o.init}</i></span>`).join("");
    const pips = (n, m, cls) => Array.from({ length: m }, (_, i) => `<i class="${i < n ? "on" : ""} ${cls}"></i>`).join("");
    const allies = partyHTML(f);
    const mine = state.turn === "me";
    // no timer on a shared turn: it waits for everyone; after 30 s of nothing from a player the leader can skip them (guard)
    const since = sess.waiting?.t0 ? Math.max(0, Math.floor((Date.now() - sess.waiting.t0) / 1000)) : 0;
    const quiet = state.turn === "wait" && !sess.mirror && sess.quiet ? sess.quiet() : [];
    const wait = state.turn === "wait" ? `<p class="tbwait"> ${esc(state.who)} ${(state.n || 1) > 1 ? "are" : "is"} choosing… ${since ? `<b class="num" id="tbcd">${since}s</b>` : ""}${quiet.map((w) => `<button class="btn sm tbskipp" data-tbx="skipp" data-pid="${esc(w.pid)}" data-tip="${esc(`No move from ${w.name} for a while: they keep their guard up this turn.`)}">Skip ${esc(w.name)}</button>`).join("")}</p>` : "";
    const scene = (newEv.length || !ui.lastScene) && typeof FIGHTART !== "undefined" ? sceneFor(newEv) : "";
    const keepScene = !scene && ui.lastScene ? el.querySelector("#tbscene > .fscene") : null;   // [phantom] nothing new happened: the scene on screen stays as it is (redrawing it played the last blow again)
    const fmt = typeof TBUI !== "undefined" ? TBUI.logLine : (e) => `<div class="tbl ${e.kind}">${esc(e.text)}</div>`;
    const recent = vis.filter((e) => e.kind !== "round"), lastE = recent[recent.length - 1];
    const log = recent.slice(-200).map((e) => fmt(e, e === lastE && newEv.includes(e))).join("");
    const atE = playing ? vis[vis.length - 1] : null;   // while playing, the bars show health as of the event on screen
    const hpMax = G.maxHealth(s), hpNow = Math.max(0, Math.round(atE?.hp ?? f.hp)), ehpNow = Math.max(0, Math.round(atE?.ehp ?? f.ehp));
    const prev = ui.prevBars || { hp: hpNow, ehp: ehpNow, mp: Math.max(0, Math.round(f.mp)), sp: Math.max(0, Math.round(f.sp)) };
    const mpNow = playing ? prev.mp : Math.max(0, Math.round(f.mp)), spNow = playing ? prev.sp : Math.max(0, Math.round(f.sp)), mpMax = G.maxMagicka(s), spMax = G.maxStamina(s);
    ui.prevBars = { hp: hpNow, ehp: ehpNow, mp: mpNow, sp: spNow };
    const pops = popsFor(newEv, f, prev, { hp: hpNow, ehp: ehpNow, mp: mpNow, sp: spNow });
    const pc = (v, m) => (100 * Math.max(0, v) / Math.max(1, m)).toFixed(1);
    const uBar = (v, p, m, cls, marks = "") => `<div class="tbbar big ${cls}"><b class="gh" style="width:${pc(Math.max(v, p), m)}%" data-to="${pc(v, m)}"></b><i style="width:${pc(v, m)}%"></i>${marks}<span class="num">${v} / ${m}</span></div>`;
    const rd = R && !playing && !sess.done ? R.panels(sess) : null;   // intents and what's coming off the bars
    const rBar = (v, p, m, cls, lb) => `<div class="tbbar mid ${cls}"><b class="gh" style="width:${pc(Math.max(v, p), m)}%" data-to="${pc(v, m)}"></b><i style="width:${pc(v, m)}%"></i><span class="num"><em>${lb}</em> ${v} / ${Math.round(m)}</span></div>`;
    let banner = "";
    if (playing) { if (R) { const e = newEv[newEv.length - 1], pv = vis[vis.length - 2]; banner = R.bannerHTML(R.banner(e, pv, sess)); } }
    else if (sess.done) banner = `<div class="tbban ${f.won ? "won" : "lost"}">${esc(sess.endLabel || (f.won ? (f.escaped ? "Escaped" : "Victory") : "Defeated"))}</div>`;
    else if (mine && ui.bannerFor !== sess.round) {
      ui.bannerFor = sess.round;
      const rb = R ? R.banner(newEv.filter((e) => e.kind === "round").pop(), null, sess) : null;   // a new round that starts with you: its summary goes under "Your turn"
      banner = rb ? R.bannerHTML({ cls: "round me", t: "Your turn", sub: `Round ${sess.round} · ${rb.sub}` }) : `<div class="tbban me">Your turn</div>`;
      if (R) R.play("turn-me");
    }
    if (R && newEv.length) { const k = Math.max(0, newEv.length - 3); newEv.slice(k).forEach((e, i) => R.play(R.cue(e, vis[vis.indexOf(e) - 1]), i * 0.25)); }
    if (typeof INITUI !== "undefined") INITUI.before(el);   // where the portraits are now, so a reorder slides
    const keepGame = ui.timing ? el.querySelector(":scope > .tbtime:not(.hit)") : null;   // [channel] an update from the party mid-minigame must not wipe your game
    el.innerHTML = `<div class="tbin">
      <div class="tbtop"><b>Round ${sess.round}</b>${typeof DIFF !== "undefined" ? DIFF.chip(f) : ""}<span class="tbord">${order}</span><button class="tbff" data-tbx="log" aria-label="Full fight log"></button>${typeof TBRADIAL !== "undefined" ? `<button class="tbff ${TBRADIAL.on() ? "on" : ""}" data-tbx="wheel" aria-label="Combat wheel and timing ring" data-tip="${typeof FIGHTCTL !== "undefined" && FIGHTCTL.on() ? "Timing ring: after a strike or a damage spell, tap when the needle is in the bright zone (Perfect +25%, a miss −20%). Tap to switch it on or off." : "Combat wheel: your moves in a ring, and a timing ring for strikes and spells (Perfect +25%, a miss −20%). Tap to switch to cards."}"></button>` : ""}</div>
      <div class="tbstage" data-tbzone="foe"><div class="tbscene" id="tbscene">${scene || (keepScene ? "" : ui.lastScene || "")}</div>${banner}${rd ? rd.bubble : ""}<div class="tbhint" aria-hidden="true"></div></div>
      <div class="tbvit"><div class="tbu me" data-tbzone="self"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.me(f, sess.st))}"` : ""}><small class="nm">\uE102 ${esc(s.name || "You")}</small>${uBar(hpNow, prev.hp, hpMax, "hp", rd ? rd.meMarks(hpNow, hpMax) : "")}${rd ? rd.meLine : ""}<div class="tbsub">${rBar(mpNow, prev.mp, mpMax, "mp", "MP")}${rBar(spNow, prev.sp, spMax, "sp", "SP")}${typeof CHARGE !== "undefined" ? CHARGE.fightBar(f) : ""}</div>${f.ward > 0 ? `<div class="tbward" title="Ward: soaks magic until it breaks. Cast it again to refill it."><i style="width:${pc(f.ward, f.wardMax || f.ward)}%"></i><span>\uE102 Ward ${Math.round(f.ward)} / ${Math.round(f.wardMax || f.ward)}</span></div>` : ""}${R ? R.myChips(f) : ""}${typeof SPELLFX !== "undefined" ? SPELLFX.meHTML(f) : ""}</div>
        <div class="tbu foe" data-tbzone="foe"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.foe(f, sess.ehpMax))}"` : ""}><small class="nm">${f.e.player ? "\uE101" : "\uE12E"} ${esc(f.e.player || typeof NAMES === "undefined" ? f.e.name : NAMES.foe(f.e.name))}${f.e.archLabel && !String(f.e.name).toLowerCase().includes(f.e.archLabel) ? ` <span class="arch">${esc(f.e.archLabel)}</span>` : ""}${sess.waves > 1 ? ` <span class="arch">${sess.wave}/${sess.waves}</span>` : ""}</small>${uBar(ehpNow, prev.ehp, sess.ehpMax, "hp foe", rd ? rd.foeMarks(ehpNow, sess.ehpMax) : "")}${rd ? rd.foeLine : ""}${statusChips(f)}${rd ? rd.intents : ""}</div></div>
      ${allies}
      <button class="tblog" aria-live="polite" data-tbx="log" aria-label="Fight log, tap for the full log"${log ? "" : " hidden"}>${log}</button>
      ${wait}
      ${playing ? `<button class="tbskip tbhurry" data-tbx="skip" aria-label="Tap the fight to hurry this turn along"></button>` : ""}
      <div class="tbdock">
        <div class="tbap">${playing ? `<em class="them">${esc(R ? R.who(vis[vis.length - 1], sess) : "")}</em>` : mine && typeof FIGHTCTL !== "undefined" && FIGHTCTL.on() ? FIGHTCTL.apHTML(sess) : mine ? `<span>AP</span>${pips(sess.st.acts - sess.myActs, sess.st.acts, "ap")}<em>Your turn${sess.until ? ` <b class="num" id="tbcd">${Math.max(0, Math.ceil((sess.until - Date.now()) / 1000))}s</b>` : ""}</em>` : sess.done ? "" : `<em class="them">${esc(sess.cur?.name || "")}'s turn…</em>`}</div>
        ${playing ? "" : sess.done ? `<button class="btn pri tbdone" data-tbx="done">${f.won ? (f.escaped ? "Continue" : "Victory — continue") : "Continue"}</button>` : mine ? actionsHTML(sess) : ""}
      </div>
      ${ui.logOpen ? fullLog(sess, fmt) : ""}
      ${ui.rosterOpen && typeof INITUI !== "undefined" ? INITUI.sheet(sess) : ""}
    </div>`;
    if (scene) ui.lastScene = scene;
    if (typeof INITUI !== "undefined") { try { INITUI.after(el, sess); } catch (e) { console.warn("roster", e); } }   // reordered portraits slide, the cause flashes (initroster.js)
    if (keepGame) el.appendChild(keepGame);
    if (keepScene) { const box = el.querySelector("#tbscene"); if (box) box.prepend(keepScene); }
    if (typeof COMBAT2 !== "undefined") { try { COMBAT2.layout(el, sess, { playing, mine, pops, big: prev.hp - hpNow > hpMax * 0.15 }); } catch (e) { console.warn("combat2", e); } }   // combat2.js: the cards go into the scene
    if (typeof TBUI !== "undefined") TBUI.after(el, { hurt: hpNow < prev.hp, hit: ehpNow < prev.ehp, big: prev.hp - hpNow > hpMax * 0.15, mine, pops });
    if (typeof FOEINTENT !== "undefined") { el.classList.toggle("tbplay", playing); try { FOEINTENT.decorate(el, sess); } catch (e) { console.warn("foe targets", e); } }   // crosshairs and the arrow
    if (typeof FIGHTTIPS !== "undefined") { try { FIGHTTIPS.decorate(el, sess); } catch (e) { console.warn("fight tips", e); } }   // tooltips on everything (fighttips.js)
    if (R) { el.classList.toggle("tbplay", playing); R.low(el, hpNow / Math.max(1, hpMax), !sess.done); }
    if (f.bf && typeof BOSSFIGHT !== "undefined") { try { BOSSFIGHT.decorate(el, sess, newEv, ehpNow, playing); } catch (e) { console.warn("boss", e); } }   // boss bar, phases, big attacks
    if (typeof REACT !== "undefined") { try { REACT.decorate(el, sess, newEv, playing); } catch (e) { console.warn("combos", e); } }   // combo icons on moves, the combo banner
    if (typeof HOTBAR !== "undefined") { try { HOTBAR.decorate(el, sess); } catch (e) { console.warn("hotbar", e); } }   // "Edit hotbar" for the … menu (hotbar.js)
    if (typeof FIGHTDC !== "undefined") { try { FIGHTDC.decorate(el, sess); } catch (e) { console.warn("declutter", e); } }   // the "…" menu, the foe's folded moves (fightdeclutter.js)
    if (typeof FOEPANEL !== "undefined") { try { FOEPANEL.decorate(el, sess); } catch (e) { console.warn("foepanel", e); } }
    if (typeof FOEFIELD !== "undefined") { try { FOEFIELD.decorate(el, sess); } catch (e) { console.warn("rows", e); } }   // [rows] both sides' front and back rows, tap a foe to aim   // the slim foe plate, the scrollable log (foepanel.js)
    if (typeof PHONEFIGHT !== "undefined") { try { PHONEFIGHT.decorate(el, sess); } catch (e) { console.warn("phonefight", e); } }   // phones: the log folds, the foe's health in numbers (phonefight.js)
    if (typeof FIGHTPRES !== "undefined") { try { FIGHTPRES.after(el); } catch (e) { console.warn("fightpres", e); } }   // one big banner at a time (fightpres.js)
  }
  /* floating numbers for what just happened: damage coloured by element, heals, crits, and what you spent */
  const ELEM = [["fire", /\b(fire|flame|burn|scorch|ember)/i], ["frost", /\b(frost|ice|cold|freez|chill)/i], ["shock", /\b(shock|lightning|spark|thunder)/i], ["poison", /\b(poison|venom|toxic)/i]];
  function elemOf(e) {
    const sp = e.a ? spellOf(e.a) : null;
    if (sp?.element && sp.element !== "none") return sp.element;
    if (/^shout:/.test(e.a || "")) return "shout";
    for (const [k, re] of ELEM) if (re.test(e.text || "")) return k;
    return "phys";
  }
  function popsFor(evs, f, was, now) {
    const out = []; let toFoe = 0, toMe = 0, healMe = 0;
    for (const e of evs) {
      const crit = /\b(critical|sneak attack|finishing blow)\b/i.test(e.text || "");
      if (e.kind === "foe" && e.dmg > 0) { out.push({ at: "me", n: -e.dmg, el: elemOf(e), crit }); toMe += e.dmg; }
      else if ((e.kind === "me" || e.kind === "ally") && e.dmg > 0) { out.push({ at: "foe", n: -e.dmg, el: elemOf(e), crit }); toFoe += e.dmg; }
      if (e.healed > 0) { out.push({ at: "me", n: e.healed, el: "heal" }); healMe += e.healed; }
      if (e.kind === "ally" && e.dmg == null) {   // summons and followers: the line only says the number
        const m = /\b(?:strikes|hits|deals|for)\s+(\d+)/i.exec(e.text || ""); if (m) { out.push({ at: "foe", n: -+m[1], el: elemOf(e) }); toFoe += +m[1]; }
      }
    }
    // whatever the lines didn't name (burning, poison over time, the foe's own regen...) still shows
    const restFoe = was.ehp - now.ehp - toFoe, restMe = was.hp - now.hp - toMe + healMe;
    if (restFoe >= 1) out.push({ at: "foe", n: -Math.round(restFoe), el: f.foeSt?.burn ? "fire" : f.foeSt?.shock ? "shock" : f.foeSt?.chill ? "frost" : "phys" });
    if (restMe >= 1) out.push({ at: "me", n: -Math.round(restMe), el: "phys" });
    for (const e of evs) { if (e.mpUp > 0) out.push({ at: "me", n: e.mpUp, el: "mp", tag: "MP" }); if (e.spUp > 0) out.push({ at: "me", n: e.spUp, el: "sp", tag: "SP" }); }   // a magicka or stamina potion working (potionfx.js)
    if (now.mp < was.mp - 0.5) out.push({ at: "me", n: now.mp - was.mp, el: "mp", tag: "MP" });
    if (now.sp < was.sp - 0.5) out.push({ at: "me", n: now.sp - was.sp, el: "sp", tag: "SP" });
    if (typeof FIGHTNUMS !== "undefined") FIGHTNUMS.extra(evs, out);   // [fightnums] Miss / Blocked / Dodged
    return out.slice(-8);
  }
  /* your party, readable at a glance: one frame per teammate (players and followers) with health numbers, what's on them,
     and a drop target, so spells, scrolls and potions can be dragged onto a teammate */
  function partyHTML(f) {
    const pc = (v, m) => (100 * Math.max(0, v) / Math.max(1, m)).toFixed(1);
    ui.prevAl = ui.prevAl || new Map();
    const one = (a, i, down) => {
      const mx = Math.round(a.maxHp || a.hpMax || a._max || Math.max(a.hp || 0, 1)), hp = Math.max(0, Math.round(a.hp || 0));
      const was = ui.prevAl.get(a) ?? hp; ui.prevAl.set(a, hp);
      const fx = [a.ward > 0 ? "" : "", a.armorT > 0 ? "" : "", a.imbue?.turns > 0 ? "" : "", a.heroT > 0 ? "⚑" : "", a.unseen > 0 ? "" : "", a.guard ? "" : "", typeof POTFX !== "undefined" ? POTFX.allyIcons(a) : ""].join("");
      const ic = a.player ? "" : a.follower ? "" : a.summon ? "✦" : "";
      const role = a.role ? ` · ${a.role}` : a.follower ? " · follower" : a.pet || a.partyPet ? " · pet" : a.player ? " · player" : "";
      const tip = `${a.name}${role}. ${down ? "Knocked down" : `${hp} / ${mx} health`}.${down ? " A Rescue spell can bring them back." : " Drag a healing spell, scroll or potion here to use it on them."}`;
      return `<div class="tbu ally${down ? " down" : ""}" data-tbzone="${down ? "ally" : "self ally"}" data-ally="${down ? 1000 + i : i}" data-tip="${esc(tip)}"><small class="nm">${ic} ${esc(a.name)}${fx ? ` <span class="fx">${fx}</span>` : ""}</small>
        <div class="tbbar mid hp"><b class="gh" style="width:${pc(Math.max(hp, was), mx)}%" data-to="${pc(hp, mx)}"></b><i style="width:${pc(hp, mx)}%"></i><span class="num">${down ? "down" : `${hp} / ${mx}`}</span></div>${!down && typeof FAI !== "undefined" ? FAI.frame(a) : ""}</div>`;
    };
    const live = f.allies.filter((a) => a.hp != null).map((a) => one(a, f.allies.indexOf(a), false));
    const downed = (f._downed || []).map((a, i) => one(a, i, true));
    const all = [...live, ...downed];
    if (!all.length) return "";
    return `<div class="tbparty${all.length > 4 ? " many" : ""}" aria-label="Your party">${all.join("")}</div>`;
  }
  /* the whole fight so far, newest round first */
  function fullLog(sess, fmt) {
    const by = new Map();
    for (const e of sess.ev) { if (e.kind === "round") continue; if (!by.has(e.round)) by.set(e.round, []); by.get(e.round).push(e); }
    const rounds = [...by.entries()].reverse().map(([r, es]) => `<h4>Round ${r}</h4>${es.map((e) => fmt(e, false)).join("")}`).join("");
    return `<div class="tbsheet" role="dialog" aria-label="Fight log"><div class="tbsh-in"><div class="tbsh-top"><b> Fight log</b><button class="tbff" data-tbx="logx" aria-label="Close the log">✕</button></div><div class="tbsh-body">${rounds || `<p class="sub">Nothing yet.</p>`}</div></div></div>`;
  }
  function statusChips(f) {
    const st = f.foeSt || {}, out = [];
    if (st.burn) out.push(`<i class="st burn" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.burn : ""}">${st.burn.turns ?? ""}</i>`);
    if (st.chill) out.push(`<i class="st chill" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.chill : ""}">${st.chill.turns ?? ""}</i>`);
    if (st.shock) out.push(`<i class="st shock" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.shock : ""}">${st.shock.turns ?? ""}</i>`);
    if (f.eParalyzed > 0) out.push(`<i class="st para" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.para : ""}">${f.eParalyzed}</i>`);
    if (f.tbStunLeft > 0) out.push(`<i class="st stun" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.stun : ""}"></i>`);
    if (f.stagger) out.push(`<i class="st stag" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.stag : ""}"></i>`);
    if (typeof FOEKIT !== "undefined") for (const [c, ic, tip] of FOEKIT.chips(f)) out.push(`<i class="st kit ${c}" data-tip="${esc(tip)}">${ic}</i>`);
    if (typeof REACT !== "undefined") for (const [c, ic, tip] of REACT.chips(f)) out.push(`<i class="st rxc rxc-${c}" data-tip="${esc(tip)}">${ic}</i>`);   // soaked, marked, burning ground (reactions.js)
    if (typeof COMBO !== "undefined") for (const [c, ic, tip] of COMBO.chips(f)) out.push(`<i class="st ${c}" data-tip="${esc(tip)}">${ic}</i>`);   // followers2: weak/resists
    if (typeof SPELLFX !== "undefined") { const h = SPELLFX.foeHTML(f); if (h) out.push(h); }   // calm, fear, walls, runes, soul trap (spellfx.js)
    // [phonefight] the other stacking statuses with their stack count (burn, chill, shock and paralysis are above)
    if (typeof FXICONS !== "undefined") for (const x of FXICONS.foe(f)) if (x.stk && x.n != null && ["poisoned", "bleeding", "vuln", "sunder", "weakened", "resolve"].includes(x.k)) out.push(`<i class="st stk fx-${x.k}" data-tip="${esc(x.tip)}" aria-label="${esc(x.lbl)}: ${x.n}">${x.ic}<small>${x.n}</small></i>`);
    return out.length ? `<div class="tbst">${out.join("")}</div>` : "";
  }
  /* animate just what happened since the last screen: a view of the fight with only those lines (the full fight-scene
     animations per weapon, spell, enemy and ally come from fightart.js) */
  /* [phantom] the fight scene's lines for some events. An end-of-round tick is a "tick", not an "attack": it used to make you swing */
  function sceneLines(evs, f) {
    return evs.filter((e) => ["me", "foe", "ally", "tick"].includes(e.kind)).map((e) => ({ turn: e.round, me: e.kind === "foe" ? "" : e.kind === "ally" ? " · " + e.text : e.text, them: e.kind === "foe" ? e.text : "", a: e.kind === "tick" ? "tick" : e.a || "attack", wt: e.wt || f.wt, hp: e.hp, ehp: e.ehp }));
  }
  function sceneFor(evs) {
    const sess = ui.sess, f = sess.f;
    const lines = sceneLines(evs, f);
    if (!lines.length && ui.lastScene) return "";
    if (!lines.length) lines.push({ turn: 0, me: "", them: "", a: "attack", wt: f.wt, hp: Math.round(f.hp), ehp: Math.round(f.ehp) });   // the opening stand-off
    const keep = fast() && !sess.done ? lines.filter((l, i) => l.me || i === lines.map((x) => !!x.them).lastIndexOf(true)) : lines;   // Fast: your moves and the foe's last blow
    const v = Object.create(f);
    v.log = keep.length ? keep : lines; v.hp0 = ui.lastHp ?? f.hp0; v.ehp0 = ui.lastEhp ?? f.ehp0; v.won = sess.done ? f.won : undefined;
    v.tbWait = sess.done ? 0 : Math.max(0, (sess.waves || 1) - (sess.wave || 1));   // [fightpos] the foes still to come stand behind this one
    v.tbTall = true; v.tbAspect = typeof COMBAT2 !== "undefined" && COMBAT2.aspect ? COMBAT2.aspect() : null; v.tbMid = !sess.done; v.tbHud = typeof COMBAT2 !== "undefined" && COMBAT2.on(); v.tbHpMax = G.maxHealth(f.s); v.tbEhpMax = sess.ehpMax;   // fightart: stay standing between turns, bars against full health
    ui.lastHp = lines[lines.length - 1].hp; ui.lastEhp = lines[lines.length - 1].ehp;
    return FIGHTART.placeholder(v, f.s);
  }
  function step(r) {
    render(r || { turn: ui.sess.done ? "done" : ui.sess.cur?.id === "me" ? "me" : "auto" });
  }
  function onClick(ev) {
    if (!ui) return;
    if (ui.timing) {   // the timing ring / minigame is up: it owns the clicks...
      // ...unless it is stuck (hotfix build 232): nothing on screen any more, or up far longer than any minigame lasts.
      // A stuck flag used to swallow every click for the rest of the fight ("I press Attack and nothing happens").
      const live = document.querySelector("#tbf .tbtime:not(.hit)");
      if (live && Date.now() - (ui.timingAt || 0) < 12000) return;
      ui.timing = false; ui.timingTok = (ui.timingTok || 0) + 1; live?.remove(); ui.sess?.release?.();   // the old game's result is dropped (and the AP it held come back)
      if (typeof CHANNEL !== "undefined") CHANNEL.cancelMine(ui.sess, "stuck");   // [channel] its bar on everyone's screen fades
    }
    const b = ev.target.closest("button"); if (!b || b.disabled) return;
    const sess = ui.sess;
    if (b.dataset.tbx === "wheel") { TBRADIAL.toggle(); return step(); }
    if (b.dataset.fc && typeof FIGHTCTL !== "undefined") { FIGHTCTL.click(b); return step(); }   // fightctl.js: ★ pins, spell filters
    if (b.dataset.tbm !== undefined) { ui.menu = b.dataset.tbm || null; return step(); }
    if (b.dataset.tbx === "autoall") { ui.menu = null; sess.autoRest = true; sess.autoTurn(); return step(sess.advance()); }   // no button for players any more; screen tests use it to finish a fight
    if (b.dataset.tbx === "done") return close();
    if (b.dataset.tbx === "skip") { ui.skip = true; try { FIGHTART.finishAll(); } catch (e) { /* nothing playing */ } return render(ui.pendState || { turn: sess.done ? "done" : sess.cur?.id === "me" ? "me" : "auto" }); }
    if (b.dataset.tbx === "log") { ui.logOpen = true; return step(); }
    if (b.dataset.tbx === "logx") { ui.logOpen = false; return step(); }
    if (b.dataset.tbx === "roster") { ui.rosterOpen = true; return step(); }   // the whole turn order (initroster.js)
    if (b.dataset.tbx === "rosterx") { ui.rosterOpen = false; return step(); }
    if (b.dataset.tbx === "skipp") { if (sess.skipPlayer && sess.skipPlayer(b.dataset.pid)) return step(sess.advance()); return step(); }   // the leader skips a quiet player: they guard
    if (typeof HOTBAR !== "undefined" && HOTBAR.click(b, sess)) { ui.menu = null; return step(); }   // hotbar.js: Edit hotbar, slots and the picker
    if (b.dataset.tba) {
      ui.menu = null;
      const root = document.getElementById("tbf"), tgt = root?.dataset.tbt; if (root) delete root.dataset.tbt;
      const a = b.dataset.tba, f = sess.f;
      const go = (g, mv) => {   // mv: [channel] a move that ran out of time becomes a guard
        if (!ui || ui.sess !== sess) return;
        const a = mv || b.dataset.tba;
        const was = { sp: f.sp, mp: f.mp, hp: f.hp };
        let r;
        try { r = sess.act(a, tgt, g ? g.mult : 1, g); }
        catch (e) { console.error("fight move", a, e); if (hooks.toast) hooks.toast("That move didn't work, try another"); return step(); }   // never leave the screen dead
        if (r?.err) { if (hooks.toast) hooks.toast(r.err); if (r.free) step(); return; }   // free: its target was already down, the AP come back
        const d = { sp: was.sp - f.sp, mp: was.mp - f.mp, hp: f.hp - was.hp };
        if (r?.turn === "next") r = sess.advance();
        if (typeof SOUND !== "undefined" && SOUND.fx && (/spell|dual|scroll/.test(a) || typeof COMBATFX === "undefined")) SOUND.fx(/spell|dual|scroll/.test(a) ? "spell" : "hit");   // blows sound on impact (combatfx)
        step(r);
        if (typeof TBRADIAL !== "undefined" && TBRADIAL.on()) TBRADIAL.spent(a === "end" || a === "flee" ? { sp: 0, mp: 0, hp: 0 } : d, g);
      };
      // the minigames (minigame.js): every blow, guard and spell you make yourself; Auto never plays them
      if (typeof MINIGAME !== "undefined" && MINIGAME.on() && MINIGAME.kindFor(f, a) && sess.canAfford(a)) {
        const sp = spellOf(a);
        ui.timing = true; ui.timingAt = Date.now(); sess.reserve(a, tgt);   // [threeap] its AP are held while you play it
        let game;
        const g0 = MINIGAME.kindFor(f, a);
        const CH = typeof CHANNEL !== "undefined" ? CHANNEL : null, ch = CH ? CH.begin(sess, a, tgt, iconOf(f, a)) : null;   // [channel] everyone sees you prepare it
        try { game = MINIGAME.play(root, f, a, { icon: iconOf(f, a), label: g0 && g0.label ? g0.label : sp ? sp.name : a === "power_attack" ? "Power attack" : a === "bash" ? "Shield bash" : a === "block" ? "Guard" : f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack", onProgress: ch ? (p) => CH.progress(sess, ch, p) : null }); }
        catch (e) { console.error("minigame", a, e); game = null; }   // a broken minigame must not lock the fight: the move goes in as a normal hit
        if (!game || typeof game.then !== "function") { ui.timing = false; if (ch) CH.done(sess, ch, null); return go(null); }
        const tok = ui.timingTok;
        if (ch) game = CH.race(ch, game);   // [channel] a hard deadline: on timeout the move is cancelled and you guard
        return game.then((g) => {
          if (!ui || ui.timingTok !== tok) return;
          ui.timing = false;
          if (ch && g === CH.TIMEOUT) { document.querySelector("#tbf .tbtime:not(.hit)")?.remove(); CH.cancel(sess, ch, "timeout"); sess.release(); return go(null, sess.canAfford("block") ? "block" : "end"); }
          if (ch) CH.done(sess, ch, g);
          go(g);
        }, () => { if (!ui || ui.timingTok !== tok) return; ui.timing = false; if (ch) CH.done(sess, ch, null); go(null); });
      }
      // the old timing ring (wheel only, when the minigames are off)
      if (typeof TBRADIAL !== "undefined" && TBRADIAL.on() && !fast() && TBRADIAL.timed(a, zoneOf(a)) && sess.canAfford(a) && typeof MINIGAME === "undefined") {
        const sp = spellOf(a), perk = typeof PFX !== "undefined" ? PFX.num(f.s, "timing") : 0;
        ui.timing = true; ui.timingAt = Date.now();
        return TBRADIAL.ring(root, { z: TBRADIAL.zone(TBRADIAL.skillFor(f, a, sp), perk), icon: iconOf(f, a), label: sp ? sp.name : a === "power_attack" ? "Power attack" : a === "bash" ? "Shield bash" : f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack" })
          .then((g) => { if (ui) ui.timing = false; go(g); });
      }
      return go(null);
    }
  }
  let waitT = null;
  function tickWait() {
    clearInterval(waitT);
    waitT = setInterval(() => {
      if (!ui) return clearInterval(waitT);
      const s = ui.sess, gr = !s.mirror && s.gr;
      if (gr && gr.me && !gr.me.done) {   // your part of a shared turn: the others' moves land as they make them, and one clock for everyone
        if (ui.timing || (typeof FIGHTART !== "undefined" && FIGHTART.playing && FIGHTART.playing())) return;
        if (gr.waits.some((w) => !w.fin && (w.move || w.reply || w.skip || s.dropped(w)))) step(s.advance());
      }
      else if (s.waiting) {   // no timer: we wait for them; after 30 s of nothing the leader gets a Skip button
        const now = Date.now(), q = s.quiet(now).length, c = document.getElementById("tbcd"); if (c) c.textContent = Math.max(0, Math.ceil((now - s.waiting.t0) / 1000)) + "s";
        if (s.gr.waits.some((x) => !x.fin && (x.move || x.reply || x.skip || s.dropped(x, now))) || q !== (ui.quietN || 0)) { ui.quietN = q; step(s.advance()); }
      }
      else if (s.mirror && s.until) { const c = document.getElementById("tbcd"); if (c) c.textContent = Math.max(0, Math.ceil((s.until - Date.now()) / 1000)) + "s"; if (Date.now() >= s.until && !ui.timing) { ui.menu = null; s.timeUp(); step(s.advance()); } }   // your turn in a teammate's fight ran out
    }, 500);
  }
  function close() {
    const el = document.getElementById("tbf");
    if (el) { el.removeEventListener("click", onClick); el.remove(); }
    clearInterval(waitT);
    if (ui) clearTimeout(ui.paceT);
    if (typeof FIGHTREAD !== "undefined") FIGHTREAD.stop();
    if (typeof HOTBAR !== "undefined") HOTBAR.reset0();
    const cb = ui?.onDone;
    if (ui?.sess?.remote) ui.sess.remote.end?.();
    ui = null; open = false;
    if (cb) cb();
  }

  /* [dundropout] end the fight on screen at once, as if it never started: the save goes back to just before it (nobody
     dies, nothing is lost) and the action that started it isn't finished. Used when a co-op run ends under you. */
  function abort() {
    if (!open) return false;
    const snap = saveSnap, liveSave = liveS;
    if (ui) ui.onDone = null;
    close();
    saveSnap = null; liveS = null; mode = null; fin = null; finalS = null; Math.random = realRandom;
    if (snap && liveSave) replaceInPlace(liveSave, snap);
    return true;
  }

  // ------------------------------------------------------------------ live party fights (everyone sees the fight; each player picks on their own phone)
  /* The phone that started the fight runs it and owns the record tbf/<id>. It keeps the record up to date (foe, health,
     log, who's in it) so party members in the fight watch it live on their own screen. When a member's turn comes the
     record holds {turn:{pid, until}} and the member's phone writes back {reply:{pid, move}}. Since v2 a whole turn comes back in tbf/<id>~<pid> (sharedfight.js).
     [initiative] A shared turn waits for several players at once: turns:[{pid, until, tid}] (turn is the first of them,
     for older phones). No timer: it waits for everyone. A teammate's phone writes tbf/<id>~<pid>~b when it picks up
     its turn and after every move (that's how the leader knows they're there; 30 s of nothing and the leader can skip). */
  const players = (sess) => [...new Set([...(sess.everyone || []), ...sess.f.allies, ...(sess.f._downed || [])])].filter((a) => a && a.player && a.pid && !a.gone);
  function fightState(sess) {
    const f = sess.f, w = sess.waiting, ws = sess.gr ? sess.gr.waits.filter((x) => !x.fin) : [];
    const tw = (x) => ({ pid: x.pid, until: x.until || 0, name: x.name, heals: x.al?.heals || 0, pots: x.al?.pots || 0, tid: x.tid || null });   // until 0: no timer
    return { foe: f.e.name, boss: !!f.e.boss, round: sess.round, wave: sess.wave || 1, waves: sess.waves || 1,
      ehp: Math.max(0, Math.round(f.ehp)), ehpMax: sess.ehpMax, ownerName: f.s.name, hp: Math.max(0, Math.round(f.hp)), hpMax: G.maxHealth(f.s),
      pids: players(sess).map((a) => a.pid),   // knocked-down players stay in: they still watch the fight to the end
      allies: f.allies.filter((a) => !a.summon).slice(0, 9).map((a) => ({ name: a.name, pid: a.pid || null, hp: Math.max(0, Math.round(a.hp ?? 0)), hpMax: Math.round(a.hp0 || a.maxHp || a.hp || 1), down: !!a.down })),
      turn: w ? tw(w) : null, turns: ws.map(tw),
      log: sess.ev.filter((e) => e.kind !== "round").slice(-6).map((e) => e.text),
      done: !!sess.done, won: sess.done ? !!f.won : null, t: Date.now() / 1000, diff: f.diff ? f.diff.id : null, ...shared(sess) };
  }
  /* v2: everything a teammate's phone needs to show the same fight on its full fight screen and play real turns in it
     (sharedfight.js). Older phones read only the fields above and keep the small "Fighting beside" box. */
  let kseq = 0;
  function shared(sess) {
    const f = sess.f;
    const all = [...new Set([...(sess.everyone || []), ...f.allies, ...(f._downed || [])])].filter((a) => a && !a.summon && !a.gone && a.hp != null);
    const fs = {}; for (const k of FOE_KEYS) if (f[k] !== undefined) fs[k] = f[k];
    const e = {}; for (const [k, v] of Object.entries(f.e || {})) if (!["loot", "drops", "group"].includes(k) && typeof v !== "function") e[k] = v;
    const look = typeof HEROART !== "undefined" && HEROART.lookOf ? (() => { try { return HEROART.lookOf(f.s); } catch (x) { return null; } })() : null;
    const roster = [{ k: "host", host: true, player: true, row: typeof FOEFIELD !== "undefined" ? FOEFIELD.myRow(f) : null, name: f.s.name || "Leader", hp: Math.max(0, Math.round(f.hp)), hpMax: G.maxHealth(f.s), down: f.hp <= 0, look, ward: Math.round(f.ward || 0), form: typeof BEASTPATH !== "undefined" ? BEASTPATH.form(f) : null, ...(f.potOT ? { potOT: f.potOT } : {}) },
      ...all.map((a) => { a.tbk = a.tbk || (a.pid ? "p:" + a.pid : "a" + ++kseq);
        const o = { k: a.tbk, pid: a.pid || null, name: a.name, hp: Math.max(0, Math.round(a.hp || 0)), hpMax: Math.round(a.maxHp || a.hpMax || a._max || a.hp0 || Math.max(1, a.hp || 1)), down: !!a.down || !f.allies.includes(a),
          player: !!a.player, follower: !!(a.follower || a.kind === "follower"), role: a.role || null, row: typeof FOEFIELD !== "undefined" ? FOEFIELD.allyRow(a) : null, look: a.look || null, kind: a.kind || null, fid: a.fid || null };
        for (const k of BUFF_KEYS) if (a[k] != null) o[k] = a[k];
        return o; })];
    if (typeof MOUNTFIGHT !== "undefined") MOUNTFIGHT.roster(f, all, roster);   // who's in the saddle, and their horses' health (mountfight.js)
    /* [partyfoeturns] the events of this round and the last one (at least 24, at most 96): a big party (8 heroes, their
       followers, a foe with 5-6 moves) easily makes more than 24 lines between two records, and a phone that missed a
       record (busy, asleep for a moment) lost the foe's moves in between: they never played on that screen */
    let from = sess.ev.length - 24;
    for (let i = sess.ev.length - 1; i >= 0 && i >= sess.ev.length - 96; i--) { if (sess.ev[i].round < (sess.round || 0) - 1) break; from = Math.min(from, i); }
    const evs = sess.ev.slice(Math.max(0, from)).map((x, i, arr) => {
      const o = { n: sess.ev.length - arr.length + i, kind: x.kind, who: x.who, text: x.text, round: x.round, hp: x.hp, ehp: x.ehp };
      for (const k of ["a", "wt", "dmg", "healed", "name", "wave", "by", "hits", "ph"]) if (x[k] != null) o[k] = x[k];
      return o;
    });
    return { v: 2, foeE: e, fs, kind: sess.kind, hitters: sess.hitters || 0, roster,
      order: sess.order.map((o) => { const x = { id: o.id, name: o.name, init: o.init, pid: o.al?.pid || null, fid: o.al?.fid || null };
        for (const k of ["side", "u", "uid", "grp", "slot", "moves", "mv", "d", "spd", "gap", "push", "why", "skip", "out", "done"]) if (o[k] != null && o[k] !== false && o[k] !== 0) x[k] = o[k];
        return x; }), idx: sess.idx, gnow: sess.gr ? sess.order[sess.gr.start]?.grp || 0 : 0,
      next: typeof INIT !== "undefined" && sess.ini ? INIT.predict(sess).map((o) => ({ id: o.id, name: o.name, init: o.init, side: o.side, slot: o.slot, pid: o.al?.pid || null, fid: o.al?.fid || null, uid: o.uid })) : [],
      cur: sess.cur ? { id: sess.cur.id, name: sess.cur.name, pid: sess.cur.al?.pid || null } : null, evs,
      escaped: sess.done ? !!f.escaped : null, ...(typeof PARTYSPELLS !== "undefined" ? PARTYSPELLS.forRecord(sess) : {}),
      ...(typeof CHANNEL !== "undefined" ? CHANNEL.forRecord(sess) : {}), ...(sess.field && typeof FOEFIELD !== "undefined" ? { field: FOEFIELD.view(sess) } : {}) };   // [channel] the moves being prepared right now (also restores them after a reconnect)   // crafted spells cast in this fight (partyspells.js)
  }
  function remoteFor(store, myId, cards) {
    if (!store || typeof store.put !== "function") return null;
    let fid = null, cur = null, watching = false, last = "", lastT = 0, made = false, timer = null, beat = null, pidsSeen = new Set();
    const push = (force) => {
      const sess = cur; if (!sess || !fid) return;
      const st = fightState(sess); if (!st.pids.length) return;
      st.pids.forEach((p) => pidsSeen.add(p));
      const k = JSON.stringify({ ...st, t: 0 });
      if (k === last && Date.now() - lastT < 14000) return;   // nothing new (a heartbeat every ~15 s so teammates know the leader's still there)
      if (!force && Date.now() - lastT < 600) { clearTimeout(timer); timer = setTimeout(() => push(true), 650); return; }
      last = k; lastT = Date.now();
      if (!made) { made = true; store.put("tbf", fid, { owner: myId, ...st }); }
      else store.change("tbf", fid, (x) => ({ ...(x || {}), owner: myId, ...st }));
    };
    const watchReplies = () => {
      if (watching || !store.watch) return; watching = true;
      store.watch("tbf", (docs) => {
        const s2 = cur; if (!s2 || !fid || !s2.gr) return;
        for (const w of s2.gr.waits) {   // everyone in the shared turn
          if (w.fin || w.reply || w.move) continue;
          const rp = docs.find((x) => x.id === `${fid}~${w.pid}`);   // a whole turn played on their own fight screen (sharedfight.js)
          if (rp && rp.tid && rp.tid === w.tid) { w.reply = rp; continue; }
          const bt = docs.find((x) => x.id === `${fid}~${w.pid}~b`);   // they picked up the turn / made a move
          if (bt && bt.bt === w.tid && bt.n !== w.beatN) { w.beatN = bt.n; w.ack = true; w.seen = Date.now(); }
          const d = docs.find((x) => x.id === fid); if (d?.reply && d.reply.pid === w.pid && d.reply.round === s2.round) w.move = d.reply.move;   // an older phone: one simple move
        }
      });
    };
    const start = (sess) => { cur = sess; fid = fid || `${myId}-${Math.floor(Date.now() / 1000)}`; watchReplies(); if (!beat) beat = setInterval(() => push(), 5000); };
    return {
      /* called whenever the fight screen updates */
      sync(sess) { if (!players(sess).length) return; start(sess); push(sess.done); },
      ask(sess) { start(sess); push(true); },
      live: () => !!store.online,
      /* is this player online? true / false, or null when we can't tell (social.js cards) */
      online: (pid) => { try { if (typeof SOCIAL === "undefined" || !cards) return null; const c = (cards() || []).find((x) => x.id === pid); return c ? !!SOCIAL.status(c).online : null; } catch (e) { return null; } },
      fid: () => fid,   // [channel] the fight record's id (channel.js reads teammates' tbf/<fid>~ch~<pid>)
      end() {
        clearTimeout(timer); clearInterval(beat); beat = null;
        if (cur && fid) { push(true); const id = fid, ps = [...pidsSeen]; setTimeout(() => { store.remove?.("tbf", id); ps.forEach((p) => { store.remove?.("tbf", `${id}~${p}`); store.remove?.("tbf", `${id}~${p}~b`); }); }, 12000); }   // members see the ending, then it's tidied away
        fid = null; cur = null; made = false; last = ""; pidsSeen = new Set();
      },
    };
  }
  /* the member's side: a fight I'm standing in shows up on my screen, live; on my turn I pick a move there */
  const watchClosed = {};
  function watchTurns(store, getMe) {
    if (!store?.watch) return;
    const bar = (v, m, cls) => `<span class="tbw-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Math.round(100 * v / Math.max(1, m))))}%"></i></span>`;
    store.watch("tbf", (docs) => {
      const me = getMe(); if (!me) return;
      const nowS = Date.now() / 1000;
      const mine = (x) => !watchClosed[x.id] && !(typeof SHAREDFIGHT !== "undefined" && SHAREDFIGHT.claims(x));   // the full shared fight screen takes these (sharedfight.js)
      const d = docs.find((x) => x.owner !== me && (x.pids || []).includes(me) && nowS - (x.t || 0) < 180 && mine(x))
        || docs.find((x) => x.turn && x.turn.pid === me && !(x.reply && x.reply.round === x.round) && (!x.turn.until || x.turn.until > Date.now()) && mine(x));
      let el = document.getElementById("tbwatch");
      if (!d || open) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement("div"); el.id = "tbwatch"; el.className = "tbwatch"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Party fight");
        el.addEventListener("click", (ev) => {
          const b = ev.target.closest("button"); if (!b) return;
          const id = el.dataset.id;
          if (b.dataset.tbwclose) { watchClosed[id] = true; el.remove(); return; }
          if (b.dataset.tbmove) { const rd = +el.dataset.round; store.change("tbf", id, (x) => (x ? { ...x, reply: { pid: getMe(), move: b.dataset.tbmove, round: rd } } : x)); el.querySelector(".tbw-turn")?.classList.add("sent"); }
        });
        document.body.appendChild(el);
      }
      el.dataset.id = d.id; el.dataset.round = d.round;
      const myTurn = d.turn && d.turn.pid === me && !(d.reply && d.reply.round === d.round) && (!d.turn.until || d.turn.until > Date.now());
      const opts = [["attack", " Attack"], ["power", " Power attack"], ["guard", " Guard"], ...(d.turn?.heals ? [["heal", "✚ Heal the leader"]] : []), ...(d.turn?.pots ? [["potion", " Potion"]] : [])];
      const lead = esc(d.ownerName || "your leader");
      const foeN = d.waves > 1 ? ` <small>foe ${d.wave} of ${d.waves}</small>` : "";
      el.innerHTML = `<div class="tbw-in">
        <div class="tbw-head"><b> Fighting beside ${lead}</b><span>Round ${d.round || 1}</span></div>
        <div class="tbw-foe"><b>${esc(d.foe)}${foeN}</b>${bar(d.ehp, d.ehpMax, "foe")}</div>
        <div class="tbw-team"><div class="tbw-m"><span>${lead} ⚑</span>${bar(d.hp, d.hpMax, "hp")}</div>${(d.allies || []).map((a) => `<div class="tbw-m${a.down ? " down" : ""}${a.pid === me ? " me" : ""}"><span>${esc(a.name)}${a.pid === me ? " (you)" : ""}${a.down ? " · down" : ""}</span>${bar(a.hp, a.hpMax, "hp")}</div>`).join("")}</div>
        <div class="tbw-log">${(d.log || []).map((t) => `<p>${esc(t)}</p>`).join("")}</div>
        ${d.done ? `<div class="tbw-end ${d.won ? "won" : "lost"}"><b>${d.won ? "Victory!" : "Defeated…"}</b><button class="btn pri" data-tbwclose="1">Continue</button></div>`
          : myTurn ? `<div class="tbw-turn"><b>Your turn</b>${d.turn.until ? ` <small class="num">${Math.max(0, Math.ceil((d.turn.until - Date.now()) / 1000))}s</small>` : ""}<div class="tbaskb">${opts.map(([k, l]) => `<button class="btn" data-tbmove="${k}">${l}</button>`).join("")}</div></div>`
          : `<p class="tbw-wait">${d.turn ? ` ${esc(d.turn.name)} is choosing…` : `${lead} is fighting. Your turn comes up in the turn order.`}</p>`}
      </div>`;
    });
  }

  /* sharedfight.js: open a teammate's view of a fight, and redraw it when the leader's phone sends news */
  function redraw(sess, state) { if (ui && ui.sess === sess && open) render(state || sess.advance()); }
  return { T, sceneLines, stats, dprOf, cost, preview, aiPick, targetOrder, Session, simulate, call, enabled, init, remoteFor, watchTurns, safeSave, zoneOf, play, redraw, fightState, voice, FOE_KEYS, BUFF_KEYS, costTxt, costHTML, base, close: () => { if (open) close(); }, abort, get open() { return open; }, get session() { return open && ui ? ui.sess : null; }, ATK_SP, AP, GUARD_AP, GUARD_MAX, apOf, guardFor, MAX_ACTS, MAX_POTS, REPEAT, HIT_CAP, FOE_HP, PARTY_HP, TURN_SECONDS, syncInPlace, _origRun: origRun };
})();
